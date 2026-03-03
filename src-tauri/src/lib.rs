mod commands;
pub mod terminal;
mod watcher;

use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub project_file_paths: Mutex<Vec<String>>,
}

pub fn run() {
    let file_paths: Vec<String> = std::env::args()
        .skip(1)
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
        .collect();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
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
        .run(tauri::generate_context!())
        .expect("error while running NoteHub");
}
