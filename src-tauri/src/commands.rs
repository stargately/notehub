use crate::terminal::TerminalState;
use crate::AppState;
use std::fs;
use std::io::Write;
use std::path::Path;
use tauri::State;

#[tauri::command]
pub fn get_project_file_paths(state: State<AppState>) -> Result<Vec<String>, String> {
    let paths = state
        .project_file_paths
        .lock()
        .map_err(|e| e.to_string())?
        .clone();
    Ok(paths)
}

#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
}

#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    let target = Path::new(&path);

    // Ensure parent directory exists
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Atomic write: write to temp file then rename
    let temp_path = format!("{}.tmp", path);
    let mut file =
        fs::File::create(&temp_path).map_err(|e| format!("Failed to create temp file: {}", e))?;
    file.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write: {}", e))?;
    file.sync_all()
        .map_err(|e| format!("Failed to sync: {}", e))?;
    fs::rename(&temp_path, &path).map_err(|e| format!("Failed to rename: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn start_watching(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let handle = app.clone();
    std::thread::spawn(move || {
        let _ = crate::watcher::start_watcher(&handle, &path);
    });
    Ok(())
}

#[tauri::command]
pub async fn stop_watching() -> Result<(), String> {
    // Watcher is stopped when the thread is dropped
    Ok(())
}

#[tauri::command]
pub fn spawn_terminal(
    app: tauri::AppHandle,
    state: State<TerminalState>,
    cwd: Option<String>,
) -> Result<u32, String> {
    crate::terminal::spawn(&state, app, cwd)
}

#[tauri::command]
pub fn write_terminal(
    state: State<TerminalState>,
    session_id: u32,
    data: String,
) -> Result<(), String> {
    crate::terminal::write(&state, session_id, &data)
}

#[tauri::command]
pub fn resize_terminal(
    state: State<TerminalState>,
    session_id: u32,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    crate::terminal::resize(&state, session_id, cols, rows)
}

#[tauri::command]
pub fn kill_terminal(state: State<TerminalState>, session_id: u32) -> Result<(), String> {
    crate::terminal::kill(&state, session_id)
}
