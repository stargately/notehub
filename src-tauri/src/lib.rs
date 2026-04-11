mod commands;
pub mod terminal;
mod watcher;

use std::sync::Mutex;
use tauri::{Emitter, Manager};

pub struct AppState {
    pub project_file_paths: Mutex<Vec<String>>,
}

fn is_markdown_file(p: &str) -> bool {
    let path = std::path::Path::new(p);
    path.exists()
        && path
            .extension()
            .map_or(false, |e| e == "md" || e == "mdx")
}

pub fn run() {
    let file_paths: Vec<String> = std::env::args()
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

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(AppState {
            project_file_paths: Mutex::new(file_paths),
        })
        .manage(terminal::TerminalState::new())
        .invoke_handler(tauri::generate_handler![
            commands::get_project_file_paths,
            commands::read_file,
            commands::write_file,
            commands::start_watching,
            commands::stop_watching,
            commands::spawn_terminal,
            commands::write_terminal,
            commands::resize_terminal,
            commands::kill_terminal,
        ])
        .setup(|app| {
            let state = app.state::<AppState>();
            let paths = state.project_file_paths.lock().unwrap().clone();
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
                let _ = app_handle.emit("open-files", &paths);
            }
        }
    });
}
