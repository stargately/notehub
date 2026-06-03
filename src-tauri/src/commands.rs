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
pub fn save_session(app: AppHandle, paths: Vec<String>, active_index: usize) -> Result<(), String> {
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

/// Sanitize a document name into a safe file basename (no extension): keep alphanumerics,
/// `-` and `_`, replace anything else with `-`, and trim leading/trailing dashes. Falls back
/// to `notehub-print` when the result is empty. This is what keeps the browser's "Save as PDF"
/// name consistent with the source `.md` file.
fn print_basename(name: Option<String>) -> String {
    let base: String = name
        .unwrap_or_default()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();
    if base.is_empty() {
        "notehub-print".to_string()
    } else {
        base
    }
}

/// Write a self-contained HTML document to a temp file and open it in the system default
/// browser. Used for printing (WKWebView does not implement JS `window.print()`).
#[tauri::command]
pub async fn print_html(app: AppHandle, html: String, name: Option<String>) -> Result<(), String> {
    use std::io::Write;
    use std::time::{SystemTime, UNIX_EPOCH};
    use tauri_plugin_opener::OpenerExt;

    // Name the temp file after the document so the browser's "Save as PDF" defaults to a
    // file name consistent with the source .md (it falls back to the page file name when a
    // viewer ignores the HTML <title>). De-duplicate with a timestamped subdir so concurrent
    // prints don't collide while the file basename stays exactly the document name.
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let file_name = format!("{}.html", print_basename(name));
    let mut dir = std::env::temp_dir();
    dir.push(format!("notehub-print-{ts}"));
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut path = dir;
    path.push(file_name);

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

#[cfg(test)]
mod tests {
    use super::{print_basename, read_file, write_file};

    #[tokio::test]
    async fn write_then_read_round_trips() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("note.md");
        let path_str = path.to_str().unwrap().to_string();

        write_file(path_str.clone(), "# hello".into())
            .await
            .unwrap();
        assert_eq!(read_file(path_str).await.unwrap(), "# hello");
    }

    #[tokio::test]
    async fn write_file_creates_missing_parent_dirs() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested/deeper/note.md");
        let path_str = path.to_str().unwrap().to_string();

        write_file(path_str.clone(), "body".into()).await.unwrap();
        assert_eq!(read_file(path_str).await.unwrap(), "body");
    }

    #[tokio::test]
    async fn read_missing_file_errors() {
        let dir = tempfile::tempdir().unwrap();
        let missing = dir.path().join("ghost.md");
        let err = read_file(missing.to_str().unwrap().to_string())
            .await
            .unwrap_err();
        assert!(err.contains("Failed to read"), "got: {err}");
    }

    #[test]
    fn keeps_plain_names_unchanged() {
        assert_eq!(print_basename(Some("my-notes".into())), "my-notes");
        assert_eq!(print_basename(Some("Chapter_01".into())), "Chapter_01");
    }

    #[test]
    fn replaces_unsafe_chars_with_dash() {
        assert_eq!(print_basename(Some("a/b c:d".into())), "a-b-c-d");
        assert_eq!(print_basename(Some("notes (final)".into())), "notes--final");
    }

    #[test]
    fn trims_leading_and_trailing_dashes() {
        assert_eq!(print_basename(Some("  spaced  ".into())), "spaced");
        assert_eq!(print_basename(Some("///x///".into())), "x");
    }

    #[test]
    fn falls_back_when_empty_or_all_unsafe() {
        assert_eq!(print_basename(None), "notehub-print");
        assert_eq!(print_basename(Some("".into())), "notehub-print");
        assert_eq!(print_basename(Some("///".into())), "notehub-print");
    }

    #[test]
    fn preserves_unicode_alphanumerics() {
        assert_eq!(print_basename(Some("日本語".into())), "日本語");
    }
}
