use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::Path;
use std::sync::mpsc::channel;
use std::time::{Duration, Instant};
use tauri::Emitter;

#[derive(Clone, Serialize)]
pub struct FileChangedPayload {
    pub path: String,
    pub kind: String,
}

pub fn start_watcher(app: &tauri::AppHandle, dir: &str) -> Result<(), String> {
    let (tx, rx) = channel::<Result<Event, notify::Error>>();

    let mut watcher = RecommendedWatcher::new(tx, Config::default())
        .map_err(|e| format!("Failed to create watcher: {}", e))?;

    watcher
        .watch(Path::new(dir), RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch directory: {}", e))?;

    let mut last_event: Option<Instant> = None;
    let debounce = Duration::from_millis(500);

    loop {
        match rx.recv_timeout(Duration::from_secs(1)) {
            Ok(Ok(event)) => {
                let now = Instant::now();
                if let Some(last) = last_event {
                    if now.duration_since(last) < debounce {
                        continue;
                    }
                }
                last_event = Some(now);

                for path in &event.paths {
                    // Skip temp files and hidden files
                    let path_str = path.to_string_lossy().to_string();
                    if path_str.ends_with(".tmp") || path_str.contains(".git") {
                        continue;
                    }

                    // Only watch .md files
                    if !path_str.ends_with(".md") {
                        continue;
                    }

                    let kind = match event.kind {
                        notify::EventKind::Create(_) => "created",
                        notify::EventKind::Modify(_) => "modified",
                        notify::EventKind::Remove(_) => "deleted",
                        _ => continue,
                    };

                    let _ = app.emit(
                        "file-changed",
                        FileChangedPayload {
                            path: path_str,
                            kind: kind.to_string(),
                        },
                    );
                }
            }
            Ok(Err(_)) => {}
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }

    Ok(())
}
