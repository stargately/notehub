use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

const MAX_BACKUPS: usize = 10;

fn notehub_dir(dir: &str) -> PathBuf {
    Path::new(dir).join(".notehub")
}

fn lock_path(dir: &str) -> PathBuf {
    notehub_dir(dir).join("session.lock")
}

fn backup_dir_for_file(file_path: &str) -> PathBuf {
    let p = Path::new(file_path);
    let parent = p.parent().unwrap_or(Path::new("."));
    let filename = p.file_name().unwrap_or_default();
    parent.join(".notehub").join("backups").join(filename)
}

/// Create .notehub/session.lock in the given directory
pub fn create_session_lock(dir: &str) -> Result<(), String> {
    let nh = notehub_dir(dir);
    fs::create_dir_all(&nh).map_err(|e| format!("Failed to create .notehub dir: {}", e))?;

    let pid = std::process::id();
    let now = chrono_timestamp();
    let content = format!("pid={}\nstarted={}\n", pid, now);

    fs::write(lock_path(dir), content)
        .map_err(|e| format!("Failed to write session.lock: {}", e))
}

/// Remove .notehub/session.lock from the given directory
pub fn remove_session_lock(dir: &str) -> Result<(), String> {
    let path = lock_path(dir);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to remove session.lock: {}", e))?;
    }
    Ok(())
}

/// Check if a stale session lock exists (different PID or process not alive)
pub fn check_stale_lock(dir: &str) -> bool {
    let path = lock_path(dir);
    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return false,
    };

    // Parse pid from lock file
    let pid: Option<u32> = content
        .lines()
        .find(|l| l.starts_with("pid="))
        .and_then(|l| l.strip_prefix("pid="))
        .and_then(|v| v.trim().parse().ok());

    let pid = match pid {
        Some(p) => p,
        None => return true, // Corrupt lock file → treat as stale
    };

    let current_pid = std::process::id();
    if pid == current_pid {
        return false; // Our own lock
    }

    // Check if the process is still alive
    !is_process_alive(pid)
}

/// Create a backup of `file_path` into .notehub/backups/<filename>/
pub fn create_backup(file_path: &str) -> Result<(), String> {
    let source = Path::new(file_path);
    if !source.exists() {
        return Ok(()); // Nothing to back up
    }

    let bdir = backup_dir_for_file(file_path);
    fs::create_dir_all(&bdir).map_err(|e| format!("Failed to create backup dir: {}", e))?;

    let timestamp = chrono_timestamp().replace(':', "-");
    let ext = source
        .extension()
        .map_or("md".to_string(), |e| e.to_string_lossy().to_string());
    let backup_name = format!("{}.{}", timestamp, ext);
    let backup_path = bdir.join(&backup_name);

    // Atomic backup: write to .tmp then rename
    let tmp_path = backup_path.with_extension("tmp");
    fs::copy(source, &tmp_path).map_err(|e| format!("Failed to copy for backup: {}", e))?;
    fs::rename(&tmp_path, &backup_path)
        .map_err(|e| format!("Failed to finalize backup: {}", e))?;

    // Rotate: keep only MAX_BACKUPS most recent
    rotate_backups(&bdir)?;

    Ok(())
}

/// List available backups for a file, newest first
pub fn list_backups(file_path: &str) -> Result<Vec<BackupInfo>, String> {
    let bdir = backup_dir_for_file(file_path);
    if !bdir.exists() {
        return Ok(vec![]);
    }

    let mut entries: Vec<BackupInfo> = fs::read_dir(&bdir)
        .map_err(|e| format!("Failed to read backup dir: {}", e))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.extension().map_or(true, |e| e == "tmp") {
                return None; // Skip temp files
            }
            let metadata = entry.metadata().ok()?;
            let name = path.file_name()?.to_string_lossy().to_string();
            // Extract timestamp from filename (remove extension)
            let timestamp = name.rsplit_once('.').map_or(&name[..], |(t, _)| t).to_string();
            Some(BackupInfo {
                original_path: file_path.to_string(),
                backup_path: path.to_string_lossy().to_string(),
                timestamp,
                size_bytes: metadata.len(),
            })
        })
        .collect();

    // Sort newest first by filename (timestamps sort lexicographically)
    entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(entries)
}

/// Restore a specific backup to the original file location
pub fn restore_backup(file_path: &str, backup_path: &str) -> Result<(), String> {
    let source = Path::new(backup_path);
    if !source.exists() {
        return Err(format!("Backup file not found: {}", backup_path));
    }

    let target = Path::new(file_path);

    // Atomic restore: copy to .tmp, then rename
    let tmp_path = format!("{}.tmp", file_path);
    fs::copy(source, &tmp_path).map_err(|e| format!("Failed to copy backup: {}", e))?;
    fs::rename(&tmp_path, target).map_err(|e| format!("Failed to restore backup: {}", e))?;

    Ok(())
}

/// Rotate backups: keep only the N most recent
fn rotate_backups(backup_dir: &Path) -> Result<(), String> {
    let mut entries: Vec<(PathBuf, SystemTime)> = fs::read_dir(backup_dir)
        .map_err(|e| format!("Failed to read backup dir: {}", e))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.extension().map_or(true, |e| e == "tmp") {
                return None;
            }
            let modified = entry.metadata().ok()?.modified().ok()?;
            Some((path, modified))
        })
        .collect();

    if entries.len() <= MAX_BACKUPS {
        return Ok(());
    }

    // Sort oldest first
    entries.sort_by(|a, b| a.1.cmp(&b.1));

    let to_remove = entries.len() - MAX_BACKUPS;
    for (path, _) in entries.into_iter().take(to_remove) {
        let _ = fs::remove_file(path);
    }

    Ok(())
}

fn chrono_timestamp() -> String {
    // Simple UTC timestamp without chrono dependency
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // Convert epoch seconds to ISO-like string
    let secs_per_day = 86400u64;
    let secs_per_hour = 3600u64;
    let secs_per_min = 60u64;

    let days = now / secs_per_day;
    let remaining = now % secs_per_day;
    let hours = remaining / secs_per_hour;
    let remaining = remaining % secs_per_hour;
    let minutes = remaining / secs_per_min;
    let seconds = remaining % secs_per_min;

    // Days since epoch to Y-M-D (simplified Gregorian)
    let (year, month, day) = days_to_ymd(days);

    format!(
        "{:04}-{:02}-{:02}T{:02}-{:02}-{:02}",
        year, month, day, hours, minutes, seconds
    )
}

fn days_to_ymd(mut days: u64) -> (u64, u64, u64) {
    // Algorithm from http://howardhinnant.github.io/date_algorithms.html
    days += 719468;
    let era = days / 146097;
    let doe = days % 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

#[cfg(unix)]
fn is_process_alive(pid: u32) -> bool {
    unsafe { libc::kill(pid as i32, 0) == 0 }
}

#[cfg(not(unix))]
fn is_process_alive(_pid: u32) -> bool {
    false // Assume dead on non-unix (conservative)
}

#[derive(Clone, Serialize)]
pub struct BackupInfo {
    pub original_path: String,
    pub backup_path: String,
    pub timestamp: String,
    pub size_bytes: u64,
}

#[derive(Clone, Serialize)]
pub struct RecoveryCandidate {
    pub file_path: String,
    pub backups: Vec<BackupInfo>,
}
