mod commands;
mod recent_docs;
pub mod terminal;
mod watcher;

use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicUsize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, Default)]
pub struct InitialSession {
    pub paths: Vec<String>,
    pub active_index: usize,
    pub workspace_root: Option<String>,
}

pub struct AppState {
    pub initial_session: Mutex<InitialSession>,
    /// Monotonic counter for unique spawned-window labels (`workspace-{n}`).
    pub window_counter: AtomicUsize,
    /// Live `window label -> canonical workspace root` map. Lets a spawned window fetch its
    /// folder and powers "re-opening the same folder focuses its window".
    pub workspace_windows: Mutex<HashMap<String, String>>,
}

#[derive(Deserialize)]
struct PersistedSession {
    paths: Vec<String>,
    #[serde(rename = "activeIndex", default)]
    active_index: usize,
    #[serde(rename = "workspaceRoot", default)]
    workspace_root: Option<String>,
}

fn is_markdown_file(p: &str) -> bool {
    let path = std::path::Path::new(p);
    path.exists() && path.extension().is_some_and(|e| e == "md" || e == "mdx")
}

pub fn session_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;
    Ok(dir.join("session.json"))
}

pub fn write_atomic(target: &Path, contents: &[u8]) -> Result<(), String> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    let temp_path = PathBuf::from(format!("{}.tmp", target.display()));
    let mut file =
        fs::File::create(&temp_path).map_err(|e| format!("Failed to create temp file: {}", e))?;
    file.write_all(contents)
        .map_err(|e| format!("Failed to write: {}", e))?;
    file.sync_all()
        .map_err(|e| format!("Failed to sync: {}", e))?;
    fs::rename(&temp_path, target).map_err(|e| format!("Failed to rename: {}", e))?;
    Ok(())
}

/// Reconcile a persisted session JSON body against reality: parse it, drop any path that no
/// longer satisfies `exists`, and clamp `active_index` into the surviving range. Pure (the
/// `exists` predicate is injected) so it can be unit-tested without disk or an `AppHandle`.
fn reconcile_session(
    body: &str,
    exists: impl Fn(&str) -> bool,
    dir_exists: impl Fn(&str) -> bool,
) -> InitialSession {
    let persisted: PersistedSession = match serde_json::from_str(body) {
        Ok(p) => p,
        Err(_) => return InitialSession::default(),
    };
    let paths: Vec<String> = persisted.paths.into_iter().filter(|p| exists(p)).collect();
    let active_index = if paths.is_empty() {
        0
    } else {
        persisted.active_index.min(paths.len() - 1)
    };
    // Drop a remembered workspace root that no longer points at an existing directory.
    let workspace_root = persisted.workspace_root.filter(|r| dir_exists(r));
    InitialSession {
        paths,
        active_index,
        workspace_root,
    }
}

fn load_persisted_session(app: &AppHandle) -> InitialSession {
    let path = match session_file_path(app) {
        Ok(p) => p,
        Err(_) => return InitialSession::default(),
    };
    let body = match fs::read_to_string(&path) {
        Ok(b) => b,
        Err(_) => return InitialSession::default(),
    };
    reconcile_session(&body, is_markdown_file, |p| Path::new(p).is_dir())
}

pub fn run() {
    let cli_paths: Vec<String> = std::env::args()
        .skip(1)
        .filter(|p| is_markdown_file(p) || std::path::Path::new(p).is_absolute())
        .map(|p| {
            let path = std::path::Path::new(&p);
            if path.is_absolute() {
                p
            } else {
                std::env::current_dir()
                    .unwrap()
                    .join(path)
                    .to_string_lossy()
                    .to_string()
            }
        })
        .filter(|p| is_markdown_file(p))
        .collect();

    let initial_from_cli = !cli_paths.is_empty();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(AppState {
            initial_session: Mutex::new(InitialSession {
                paths: cli_paths,
                active_index: 0,
                workspace_root: None,
            }),
            window_counter: AtomicUsize::new(1),
            workspace_windows: Mutex::new(HashMap::new()),
        })
        .manage(terminal::TerminalState::new())
        .invoke_handler(tauri::generate_handler![
            commands::get_project_file_paths,
            commands::save_session,
            commands::note_recent_document,
            commands::read_file,
            commands::write_file,
            commands::read_dir,
            commands::read_text_file,
            commands::is_directory,
            commands::canonicalize,
            commands::open_workspace_window,
            commands::get_window_workspace,
            commands::set_workspace_root,
            commands::print_html,
            commands::start_watching,
            commands::stop_watching,
            commands::spawn_terminal,
            commands::write_terminal,
            commands::resize_terminal,
            commands::kill_terminal,
        ])
        .setup(move |app| {
            let state = app.state::<AppState>();
            // If launched without CLI file args, fall back to the persisted session.
            if !initial_from_cli {
                let restored = load_persisted_session(app.handle());
                if !restored.paths.is_empty() || restored.workspace_root.is_some() {
                    *state.initial_session.lock().unwrap() = restored;
                }
            }
            // Register the main window's restored workspace root so re-opening the same folder
            // focuses this window instead of spawning a duplicate.
            if let Some(root) = state.initial_session.lock().unwrap().workspace_root.clone() {
                state
                    .workspace_windows
                    .lock()
                    .unwrap()
                    .insert("main".to_string(), root);
            }
            let paths = state.initial_session.lock().unwrap().paths.clone();
            // Register initial files in macOS' Recent Documents (Dock submenu)
            for p in &paths {
                recent_docs::note(app.handle(), p.clone());
            }
            // Start a file watcher for each unique parent directory
            let mut watched_dirs = std::collections::HashSet::new();
            for p in &paths {
                if let Some(dir) = std::path::Path::new(p)
                    .parent()
                    .map(|d| d.to_string_lossy().to_string())
                {
                    if watched_dirs.insert(dir.clone()) {
                        let handle = app.handle().clone();
                        std::thread::spawn(move || {
                            let _ = watcher::start_watcher(&handle, &dir);
                        });
                    }
                }
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error building NoteHub");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Opened { urls } = event {
            // Files opened via Finder / dropped on the Dock icon. Directories open as a
            // workspace (file tree); markdown files open as tabs.
            let resolved: Vec<PathBuf> = urls
                .iter()
                .filter_map(|url| url.to_file_path().ok())
                .collect();
            let folders: Vec<String> = resolved
                .iter()
                .filter(|p| p.is_dir())
                .map(|p| p.to_string_lossy().to_string())
                .collect();
            let files: Vec<String> = resolved
                .iter()
                .filter(|p| p.extension().is_some_and(|e| e == "md" || e == "mdx"))
                .map(|p| p.to_string_lossy().to_string())
                .collect();
            if !files.is_empty() {
                for p in &files {
                    recent_docs::note(app_handle, p.clone());
                }
                let _ = app_handle.emit("open-files", &files);
            }
            for folder in folders {
                let _ = app_handle.emit("open-folder", folder);
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::{is_markdown_file, reconcile_session, write_atomic};
    use std::fs;

    #[test]
    fn is_markdown_file_accepts_existing_md_and_mdx() {
        let dir = tempfile::tempdir().unwrap();
        for name in ["note.md", "note.mdx"] {
            let path = dir.path().join(name);
            fs::write(&path, b"hi").unwrap();
            assert!(
                is_markdown_file(path.to_str().unwrap()),
                "{name} should pass"
            );
        }
    }

    #[test]
    fn is_markdown_file_rejects_other_extensions_and_missing_files() {
        let dir = tempfile::tempdir().unwrap();
        let txt = dir.path().join("note.txt");
        fs::write(&txt, b"hi").unwrap();
        assert!(!is_markdown_file(txt.to_str().unwrap()));

        let extensionless = dir.path().join("note");
        fs::write(&extensionless, b"hi").unwrap();
        assert!(!is_markdown_file(extensionless.to_str().unwrap()));

        // An .md path that does not exist on disk must be rejected.
        let missing = dir.path().join("ghost.md");
        assert!(!is_markdown_file(missing.to_str().unwrap()));
    }

    #[test]
    fn write_atomic_writes_creates_parents_and_overwrites() {
        let dir = tempfile::tempdir().unwrap();
        // Target lives in a not-yet-existing nested directory.
        let target = dir.path().join("nested/deeper/session.json");

        write_atomic(&target, b"first").unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "first");

        // Overwrites in place.
        write_atomic(&target, b"second").unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "second");

        // No leftover temp file beside the target.
        let tmp = dir.path().join("nested/deeper/session.json.tmp");
        assert!(!tmp.exists());
    }

    #[test]
    fn reconcile_session_defaults_on_garbage_json() {
        let session = reconcile_session("not json at all", |_| true, |_| true);
        assert!(session.paths.is_empty());
        assert_eq!(session.active_index, 0);
    }

    #[test]
    fn reconcile_session_keeps_all_paths_when_all_exist() {
        let body = r#"{"paths":["a.md","b.md","c.md"],"activeIndex":1}"#;
        let session = reconcile_session(body, |_| true, |_| true);
        assert_eq!(session.paths, vec!["a.md", "b.md", "c.md"]);
        assert_eq!(session.active_index, 1);
    }

    #[test]
    fn reconcile_session_drops_missing_paths() {
        let body = r#"{"paths":["keep.md","gone.md","keep2.md"],"activeIndex":0}"#;
        let session = reconcile_session(body, |p| p != "gone.md", |_| true);
        assert_eq!(session.paths, vec!["keep.md", "keep2.md"]);
    }

    #[test]
    fn reconcile_session_clamps_active_index_into_range() {
        let body = r#"{"paths":["a.md","b.md"],"activeIndex":9}"#;
        let session = reconcile_session(body, |_| true, |_| true);
        assert_eq!(session.active_index, 1);
    }

    #[test]
    fn reconcile_session_resets_index_when_no_paths_survive() {
        let body = r#"{"paths":["a.md","b.md"],"activeIndex":1}"#;
        let session = reconcile_session(body, |_| false, |_| true);
        assert!(session.paths.is_empty());
        assert_eq!(session.active_index, 0);
    }

    #[test]
    fn reconcile_session_defaults_active_index_when_absent() {
        // `activeIndex` omitted — serde default of 0 applies.
        let body = r#"{"paths":["a.md"]}"#;
        let session = reconcile_session(body, |_| true, |_| true);
        assert_eq!(session.active_index, 0);
    }

    #[test]
    fn reconcile_session_keeps_workspace_root_when_dir_exists() {
        let body = r#"{"paths":[],"activeIndex":0,"workspaceRoot":"/home/me/proj"}"#;
        let session = reconcile_session(body, |_| true, |_| true);
        assert_eq!(session.workspace_root.as_deref(), Some("/home/me/proj"));
    }

    #[test]
    fn reconcile_session_drops_workspace_root_when_dir_missing() {
        let body = r#"{"paths":[],"activeIndex":0,"workspaceRoot":"/home/me/gone"}"#;
        let session = reconcile_session(body, |_| true, |_| false);
        assert_eq!(session.workspace_root, None);
    }

    #[test]
    fn reconcile_session_workspace_root_absent_is_none() {
        let body = r#"{"paths":["a.md"],"activeIndex":0}"#;
        let session = reconcile_session(body, |_| true, |_| true);
        assert_eq!(session.workspace_root, None);
    }
}
