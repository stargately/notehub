mod commands;
mod recent_docs;
pub mod terminal;
mod watcher;

use serde::Deserialize;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, Default)]
pub struct InitialSession {
    pub paths: Vec<String>,
    pub active_index: usize,
}

pub struct AppState {
    pub initial_session: Mutex<InitialSession>,
}

#[derive(Deserialize)]
struct PersistedSession {
    paths: Vec<String>,
    #[serde(rename = "activeIndex", default)]
    active_index: usize,
}

fn is_markdown_file(p: &str) -> bool {
    let path = std::path::Path::new(p);
    path.exists()
        && path
            .extension()
            .map_or(false, |e| e == "md" || e == "mdx")
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
    let mut file = fs::File::create(&temp_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
    file.write_all(contents)
        .map_err(|e| format!("Failed to write: {}", e))?;
    file.sync_all()
        .map_err(|e| format!("Failed to sync: {}", e))?;
    fs::rename(&temp_path, target).map_err(|e| format!("Failed to rename: {}", e))?;
    Ok(())
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
    let persisted: PersistedSession = match serde_json::from_str(&body) {
        Ok(p) => p,
        Err(_) => return InitialSession::default(),
    };
    let paths: Vec<String> = persisted
        .paths
        .into_iter()
        .filter(|p| is_markdown_file(p))
        .collect();
    let active_index = if paths.is_empty() {
        0
    } else {
        persisted.active_index.min(paths.len() - 1)
    };
    InitialSession {
        paths,
        active_index,
    }
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
            }),
        })
        .manage(terminal::TerminalState::new())
        .invoke_handler(tauri::generate_handler![
            commands::get_project_file_paths,
            commands::save_session,
            commands::note_recent_document,
            commands::read_file,
            commands::write_file,
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
                if !restored.paths.is_empty() {
                    *state.initial_session.lock().unwrap() = restored;
                }
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
            let paths: Vec<String> = urls
                .iter()
                .filter_map(|url| url.to_file_path().ok())
                .filter(|p| {
                    p.extension()
                        .map_or(false, |e| e == "md" || e == "mdx")
                })
                .map(|p| p.to_string_lossy().to_string())
                .collect();
            if !paths.is_empty() {
                for p in &paths {
                    recent_docs::note(app_handle, p.clone());
                }
                let _ = app_handle.emit("open-files", &paths);
            }
        }
    });
}
