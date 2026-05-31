use crate::terminal::TerminalState;
use crate::{session_file_path, write_atomic, AppState, InitialSession};
use serde::Serialize;
use std::fs;
use std::path::Path;
use tauri::{AppHandle, State};

#[derive(Serialize)]
pub struct InitialSessionPayload {
    pub paths: Vec<String>,
    #[serde(rename = "activeIndex")]
    pub active_index: usize,
}

#[tauri::command]
pub fn get_project_file_paths(state: State<AppState>) -> Result<InitialSessionPayload, String> {
    let session = state
        .initial_session
        .lock()
        .map_err(|e| e.to_string())?
        .clone();
    let InitialSession {
        paths,
        active_index,
    } = session;
    Ok(InitialSessionPayload {
        paths,
        active_index,
    })
}

#[tauri::command]
pub fn save_session(
    app: AppHandle,
    paths: Vec<String>,
    active_index: usize,
) -> Result<(), String> {
    let path = session_file_path(&app)?;
    let payload = serde_json::json!({
        "paths": paths,
        "activeIndex": active_index,
    });
    let body = serde_json::to_vec(&payload).map_err(|e| e.to_string())?;
    write_atomic(&path, &body)
}

#[tauri::command]
pub fn note_recent_document(app: AppHandle, path: String) {
    crate::recent_docs::note(&app, path);
}

#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
}

#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    write_atomic(Path::new(&path), content.as_bytes())
}

/// Write a self-contained HTML document to a temp file and open it in the system default
/// browser. Used for printing (WKWebView does not implement JS `window.print()`).
#[tauri::command]
pub async fn print_html(app: AppHandle, html: String) -> Result<(), String> {
    use std::io::Write;
    use std::time::{SystemTime, UNIX_EPOCH};
    use tauri_plugin_opener::OpenerExt;

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let mut path = std::env::temp_dir();
    path.push(format!("notehub-print-{ts}.html"));

    let mut file = fs::File::create(&path).map_err(|e| e.to_string())?;
    file.write_all(html.as_bytes()).map_err(|e| e.to_string())?;

    app.opener()
        .open_path(path.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| e.to_string())
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
