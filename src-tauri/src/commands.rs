use crate::terminal::TerminalState;
use crate::{session_file_path, write_atomic, AppState, InitialSession};
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};

#[derive(Serialize)]
pub struct InitialSessionPayload {
    pub paths: Vec<String>,
    #[serde(rename = "activeIndex")]
    pub active_index: usize,
    #[serde(rename = "workspaceRoot")]
    pub workspace_root: Option<String>,
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
        workspace_root,
    } = session;
    Ok(InitialSessionPayload {
        paths,
        active_index,
        workspace_root,
    })
}

#[tauri::command]
pub fn save_session(
    app: AppHandle,
    paths: Vec<String>,
    active_index: usize,
    workspace_root: Option<String>,
) -> Result<(), String> {
    let path = session_file_path(&app)?;
    let payload = serde_json::json!({
        "paths": paths,
        "activeIndex": active_index,
        "workspaceRoot": workspace_root,
    });
    let body = serde_json::to_vec(&payload).map_err(|e| e.to_string())?;
    write_atomic(&path, &body)
}

/// One entry in a directory listing returned to the file-tree sidebar. `is_dir` is kept in
/// snake_case so the frontend `DirEntry` type matches the JSON verbatim.
#[derive(Serialize, Debug)]
pub struct DirEntryInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

/// Directories/files that are almost never useful in a project tree. Hidden from `read_dir`
/// results by default and reused by the file watcher (`watcher::should_skip_path`) so edits
/// inside them never trigger reloads. Note dotfiles in general are *not* noise — only this set.
pub(crate) fn is_noise_dir(name: &str) -> bool {
    matches!(name, ".git" | "node_modules" | ".DS_Store")
}

/// Order a directory listing the way an explorer renders it: folders first, then
/// case-insensitive alphabetical within each group. Pure so it can be unit-tested.
fn sort_dir_entries(mut entries: Vec<DirEntryInfo>) -> Vec<DirEntryInfo> {
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    entries
}

/// Heuristic binary-file check: a NUL byte within the first 8 KB (git uses the same trick).
/// Lets the raw file viewer fall back to an "is binary" branch instead of showing garbage.
fn looks_binary(sample: &[u8]) -> bool {
    sample.iter().take(8192).any(|&b| b == 0)
}

/// Find the label of an already-open window whose workspace root equals `folder` (both should
/// be canonicalized before calling). Drives "re-opening the same folder focuses its window".
fn find_window_for_workspace<'a>(
    open: &'a HashMap<String, String>,
    folder: &str,
) -> Option<&'a str> {
    open.iter()
        .find(|(_, root)| root.as_str() == folder)
        .map(|(label, _)| label.as_str())
}

/// List one level of a directory (the sidebar lazy-loads deeper levels on expand). Uses
/// `file_type()` rather than `metadata()` so symlinks are reported without being followed.
#[tauri::command]
pub async fn read_dir(path: String) -> Result<Vec<DirEntryInfo>, String> {
    let rd = fs::read_dir(&path).map_err(|e| format!("Failed to read dir {}: {}", path, e))?;
    let mut entries = Vec::new();
    for entry in rd {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if is_noise_dir(&name) {
            continue;
        }
        let is_dir = entry.file_type().map_err(|e| e.to_string())?.is_dir();
        entries.push(DirEntryInfo {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir,
        });
    }
    Ok(sort_dir_entries(entries))
}

/// One file in the recursive workspace index returned to the quick-open finder. snake_case so the
/// frontend `FileEntry` type matches the JSON verbatim (same convention as `DirEntryInfo`).
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct FileEntry {
    pub path: String,
    pub rel: String,
    pub name: String,
}

/// Hard cap on indexed files so a huge tree can't blow up the walk or the JSON payload.
const MAX_INDEX_FILES: usize = 20_000;

/// The `/`-separated path of `path` relative to `root` (the fuzzy-match target). Falls back to the
/// basename when `path` isn't under `root`. Pure (string-level) so it's unit-testable.
fn rel_path(root: &Path, path: &Path) -> String {
    match path.strip_prefix(root) {
        Ok(rel) => rel.to_string_lossy().replace('\\', "/"),
        Err(_) => path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default(),
    }
}

/// Recursively collect every file under `root`, honoring `.gitignore`/`.ignore` (via the `ignore`
/// crate, even outside a git repo) and skipping `is_noise_dir` directories, capped at
/// `MAX_INDEX_FILES`. Dotfiles are kept (NoteHub shows them in the tree). Files only — directories
/// aren't openable as tabs. Driven by a real filesystem path so a tempdir exercises it in tests.
fn walk_files(root: &Path) -> Vec<FileEntry> {
    let mut out = Vec::new();
    let walker = ignore::WalkBuilder::new(root)
        .hidden(false) // keep dotfiles; .gitignore rules still apply
        .require_git(false) // honor .gitignore even when the folder isn't a git repo
        .filter_entry(|e| {
            // Prune noise dirs (.git/node_modules/.DS_Store) regardless of gitignore state.
            e.file_name()
                .to_str()
                .map(|n| !is_noise_dir(n))
                .unwrap_or(true)
        })
        .build();
    for dent in walker.flatten() {
        if out.len() >= MAX_INDEX_FILES {
            break;
        }
        if dent.file_type().map(|t| t.is_file()).unwrap_or(false) {
            let path = dent.path();
            out.push(FileEntry {
                path: path.to_string_lossy().to_string(),
                rel: rel_path(root, path),
                name: dent.file_name().to_string_lossy().to_string(),
            });
        }
    }
    out
}

/// Recursively list every file under `root` for the quick-open fuzzy finder. Gitignore-aware (see
/// `walk_files`). `root` is canonicalized so the absolute paths match `openPath`'s canonical form
/// and the watcher's realpath events.
#[tauri::command]
pub async fn list_workspace_files(root: String) -> Result<Vec<FileEntry>, String> {
    let base = fs::canonicalize(&root).map_err(|e| format!("Failed to index {}: {}", root, e))?;
    Ok(walk_files(&base))
}

/// Read a file as UTF-8 text, returning `Err("binary")` for non-text files so the frontend
/// can render an "is binary" placeholder. Distinct from `read_file` (used by the markdown
/// editors), which is intentionally left unchanged.
#[tauri::command]
pub async fn read_text_file(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| format!("Failed to read {}: {}", path, e))?;
    if looks_binary(&bytes) {
        return Err("binary".to_string());
    }
    String::from_utf8(bytes).map_err(|_| "binary".to_string())
}

/// Whether `path` points at a directory — lets the frontend route a dropped path to the
/// workspace tree (folder) versus a tab (file).
#[tauri::command]
pub fn is_directory(path: String) -> bool {
    Path::new(&path).is_dir()
}

/// Resolve a path to its canonical form (symlinks/`.`/`..` removed). The workspace root is
/// canonicalized so tree paths match the realpaths the OS watcher reports (e.g. macOS
/// surfaces `/tmp/x` as `/private/tmp/x`), like VS Code normalizes watcher paths.
#[tauri::command]
pub fn canonicalize(path: String) -> Result<String, String> {
    fs::canonicalize(&path)
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| format!("Failed to canonicalize {}: {}", path, e))
}

/// Open `folder` as a workspace. If a window already owns that folder, focus it; otherwise
/// spawn a fresh window and remember its `label -> canonical(folder)` mapping so the new
/// window can fetch its root via `get_window_workspace` and future dedup works.
#[tauri::command]
pub async fn open_workspace_window(
    app: AppHandle,
    state: State<'_, AppState>,
    folder: String,
) -> Result<(), String> {
    let canonical = fs::canonicalize(&folder)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or(folder);

    // Same folder already open → focus that window instead of duplicating it.
    {
        let map = state.workspace_windows.lock().map_err(|e| e.to_string())?;
        if let Some(label) = find_window_for_workspace(&map, &canonical) {
            if let Some(win) = app.get_webview_window(label) {
                let _ = win.set_focus();
                return Ok(());
            }
        }
    }

    let id = state.window_counter.fetch_add(1, Ordering::SeqCst);
    let label = format!("workspace-{}", id);
    state
        .workspace_windows
        .lock()
        .map_err(|e| e.to_string())?
        .insert(label.clone(), canonical);

    WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html".into()))
        .title("NoteHub")
        .inner_size(1200.0, 800.0)
        .min_inner_size(800.0, 500.0)
        .build()
        .map_err(|e| format!("Failed to open window: {}", e))?;

    Ok(())
}

/// Return the workspace root this window was opened for (set by `open_workspace_window` or
/// `set_workspace_root`). `None` for a window that has no workspace yet.
#[tauri::command]
pub fn get_window_workspace(
    window: tauri::WebviewWindow,
    state: State<AppState>,
) -> Result<Option<String>, String> {
    let label = window.label().to_string();
    Ok(state
        .workspace_windows
        .lock()
        .map_err(|e| e.to_string())?
        .get(&label)
        .cloned())
}

/// Record (or clear, with `None`) the workspace root the calling window has adopted. Keeps the
/// live `label -> root` map in sync so same-folder dedup works for folders opened in-place
/// (e.g. the first folder opened in a fresh window). Persistence across restarts is handled
/// separately by `save_session`.
#[tauri::command]
pub fn set_workspace_root(
    window: tauri::WebviewWindow,
    state: State<AppState>,
    path: Option<String>,
) -> Result<(), String> {
    let label = window.label().to_string();
    let mut map = state.workspace_windows.lock().map_err(|e| e.to_string())?;
    match path {
        Some(p) => {
            let canonical = fs::canonicalize(&p)
                .map(|x| x.to_string_lossy().to_string())
                .unwrap_or(p);
            map.insert(label, canonical);
        }
        None => {
            map.remove(&label);
        }
    }
    Ok(())
}

/// Logical (CSS-pixel) outer bounds of a window — its position + size on the virtual screen,
/// in the same coordinate space as DOM `MouseEvent.screenX/screenY` so the frontend can decide
/// whether a tab was released outside the window (tab tear-off).
#[derive(Serialize)]
pub struct WindowRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Return the calling window's outer rect in logical pixels. `outer_position`/`outer_size` are
/// physical in Tauri v2; dividing by the scale factor matches DOM screen coords on HiDPI displays.
#[tauri::command]
pub fn get_window_rect(window: tauri::WebviewWindow) -> Result<WindowRect, String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let pos = window
        .outer_position()
        .map_err(|e| e.to_string())?
        .to_logical::<f64>(scale);
    let size = window
        .outer_size()
        .map_err(|e| e.to_string())?
        .to_logical::<f64>(scale);
    Ok(WindowRect {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
    })
}

/// Close the calling window. ⌘W in the frontend closes the active tab and, when no tabs remain,
/// falls through to here to close the window (Zed/VS Code style). Routed through Rust so no
/// `core:window` capability is needed (matching the geometry/tear-off commands).
#[tauri::command]
pub fn close_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

/// Where to place a torn-off window so its title bar lands roughly under the cursor: nudge the
/// release point up/left a little, clamped to the visible origin. Pure for unit testing.
fn title_bar_anchor(screen_x: f64, screen_y: f64) -> (f64, f64) {
    ((screen_x - 60.0).max(0.0), (screen_y - 12.0).max(0.0))
}

/// Remove and return the files stashed for `label` (empty if none). Pure for unit testing.
fn drain_window_files(map: &mut HashMap<String, Vec<String>>, label: &str) -> Vec<String> {
    map.remove(label).unwrap_or_default()
}

/// Open `path` in a brand-new window near the release point — tab tear-off. Unlike
/// `open_workspace_window` this carries a *file* (not a folder): the file is stashed under the new
/// window's label in `AppState.window_files` and drained by `get_window_files` when that window
/// mounts. The new window adopts no workspace folder, so folder dedup is untouched. Returns the
/// new window label.
#[tauri::command]
pub async fn detach_tab(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
    screen_x: f64,
    screen_y: f64,
) -> Result<String, String> {
    let canonical = fs::canonicalize(&path)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or(path);

    let id = state.window_counter.fetch_add(1, Ordering::SeqCst);
    let label = format!("workspace-{}", id);
    state
        .window_files
        .lock()
        .map_err(|e| e.to_string())?
        .insert(label.clone(), vec![canonical]);

    let (x, y) = title_bar_anchor(screen_x, screen_y);
    WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html".into()))
        .title("NoteHub")
        .inner_size(1200.0, 800.0)
        .min_inner_size(800.0, 500.0)
        .position(x, y)
        .build()
        .map_err(|e| {
            // Roll back the stash so a failed build doesn't leak an entry.
            if let Ok(mut m) = state.window_files.lock() {
                m.remove(&label);
            }
            format!("Failed to open window: {}", e)
        })?;

    Ok(label)
}

/// Files a freshly-spawned window should open on mount (tab tear-off). Drains the entry so it's
/// consumed exactly once; empty for normal folder-workspace windows.
#[tauri::command]
pub fn get_window_files(
    window: tauri::WebviewWindow,
    state: State<AppState>,
) -> Result<Vec<String>, String> {
    let label = window.label().to_string();
    let mut map = state.window_files.lock().map_err(|e| e.to_string())?;
    Ok(drain_window_files(&mut map, &label))
}

/// Toggle the native File menu's focus-dependent items (Save / New File / New Folder / Refresh)
/// to match the calling window's state. The frontend calls this on focus + workspace/tab changes so
/// the shared app menu always reflects the focused window.
#[tauri::command]
pub fn update_file_menu(
    state: State<AppState>,
    has_workspace: bool,
    can_save: bool,
) -> Result<(), String> {
    crate::menu::set_file_menu_enabled(&state, has_workspace, can_save);
    Ok(())
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

/// Validate a single user-typed path *component* (a file or folder name). Rejects empty/whitespace,
/// `.`/`..`, and any path separator or NUL — so a create/rename can never traverse out of its
/// parent directory. Pure → unit-tested.
fn is_valid_filename(name: &str) -> bool {
    let trimmed = name.trim();
    !trimmed.is_empty()
        && trimmed != "."
        && trimmed != ".."
        && !trimmed.contains('/')
        && !trimmed.contains('\\')
        && !trimmed.contains('\0')
}

/// Create an empty file at `path`. Errors if it already exists (never clobber) or the basename is
/// invalid. Creates missing parent dirs (like `write_atomic`). Returns the canonical path so the
/// caller can open + select the file without a second round-trip.
#[tauri::command]
pub async fn create_file(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
    if !is_valid_filename(name) {
        return Err("Invalid file name".into());
    }
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create folder: {}", e))?;
    }
    fs::OpenOptions::new()
        .write(true)
        .create_new(true) // atomic "fail if exists"
        .open(p)
        .map_err(|e| format!("Failed to create file: {}", e))?;
    fs::canonicalize(p)
        .map(|c| c.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

/// Create a directory at `path`. Errors if it already exists or the basename is invalid. Returns
/// the canonical path.
#[tauri::command]
pub async fn create_dir(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
    if !is_valid_filename(name) {
        return Err("Invalid folder name".into());
    }
    fs::create_dir(p).map_err(|e| format!("Failed to create folder: {}", e))?;
    fs::canonicalize(p)
        .map(|c| c.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

/// Rename/move `from` → `to` (works for files and folders). Errors if `to` already exists (no
/// overwrite) or the new basename is invalid. Returns the canonical `to`.
#[tauri::command]
pub async fn rename_path(from: String, to: String) -> Result<String, String> {
    let to_p = Path::new(&to);
    let name = to_p.file_name().and_then(|n| n.to_str()).unwrap_or("");
    if !is_valid_filename(name) {
        return Err("Invalid name".into());
    }
    if to_p.exists() {
        return Err(format!("\"{}\" already exists", name));
    }
    fs::rename(&from, to_p).map_err(|e| format!("Failed to rename: {}", e))?;
    fs::canonicalize(to_p)
        .map(|c| c.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

/// Move `path` to the OS trash (recoverable — matches Finder/Zed). Works for files and folders.
#[tauri::command]
pub async fn delete_path(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| format!("Failed to move to Trash: {}", e))
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
    // Idempotent: dedups against directories already watched (workspace root, restored files).
    crate::ensure_watching(&app, &path);
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
    use super::{
        canonicalize, create_dir, create_file, drain_window_files, find_window_for_workspace,
        is_directory, is_noise_dir, is_valid_filename, looks_binary, print_basename, read_dir,
        read_file, read_text_file, rel_path, rename_path, sort_dir_entries, title_bar_anchor,
        walk_files, write_file, DirEntryInfo,
    };
    use std::collections::HashMap;
    use std::path::Path;

    #[test]
    fn drain_window_files_returns_entry_once_then_empty() {
        let mut map: HashMap<String, Vec<String>> = HashMap::new();
        map.insert("workspace-2".into(), vec!["/a.md".into()]);
        assert_eq!(
            drain_window_files(&mut map, "workspace-2"),
            vec!["/a.md".to_string()]
        );
        // Consumed — a second drain (e.g. a reload) yields nothing.
        assert!(drain_window_files(&mut map, "workspace-2").is_empty());
        // Unknown label → empty.
        assert!(drain_window_files(&mut map, "workspace-9").is_empty());
    }

    #[test]
    fn title_bar_anchor_offsets_and_clamps() {
        assert_eq!(title_bar_anchor(300.0, 200.0), (240.0, 188.0));
        // Near the screen origin, the offset is clamped to 0 (never off-screen).
        assert_eq!(title_bar_anchor(10.0, 5.0), (0.0, 0.0));
    }

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

    fn entry(name: &str, is_dir: bool) -> DirEntryInfo {
        DirEntryInfo {
            name: name.into(),
            path: format!("/root/{name}"),
            is_dir,
        }
    }

    #[test]
    fn sort_puts_dirs_before_files() {
        let sorted = sort_dir_entries(vec![
            entry("zebra.md", false),
            entry("src", true),
            entry("apple.md", false),
            entry("docs", true),
        ]);
        let names: Vec<_> = sorted.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["docs", "src", "apple.md", "zebra.md"]);
    }

    #[test]
    fn sort_is_case_insensitive_within_a_group() {
        let sorted = sort_dir_entries(vec![
            entry("Banana.md", false),
            entry("apple.md", false),
            entry("Cherry.md", false),
        ]);
        let names: Vec<_> = sorted.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["apple.md", "Banana.md", "Cherry.md"]);
    }

    #[test]
    fn sort_is_stable_on_empty_input() {
        assert!(sort_dir_entries(vec![]).is_empty());
    }

    #[test]
    fn noise_dirs_are_recognized() {
        assert!(is_noise_dir(".git"));
        assert!(is_noise_dir("node_modules"));
        assert!(is_noise_dir(".DS_Store"));
        assert!(!is_noise_dir("src"));
        assert!(!is_noise_dir(".github")); // dotfiles in general are not noise
        assert!(!is_noise_dir("notes.md"));
    }

    #[test]
    fn looks_binary_detects_nul_bytes() {
        assert!(!looks_binary(b"plain text"));
        assert!(!looks_binary(b""));
        assert!(looks_binary(b"text\0with nul"));
        // A NUL beyond the 8 KB sample window is not inspected.
        let mut late = vec![b'a'; 9000];
        late.push(0);
        assert!(!looks_binary(&late));
    }

    #[test]
    fn find_window_matches_canonical_root() {
        let mut map = HashMap::new();
        map.insert("workspace-1".to_string(), "/home/me/proj".to_string());
        map.insert("main".to_string(), "/home/me/other".to_string());
        assert_eq!(
            find_window_for_workspace(&map, "/home/me/proj"),
            Some("workspace-1")
        );
        assert_eq!(find_window_for_workspace(&map, "/home/me/missing"), None);
    }

    #[tokio::test]
    async fn read_dir_lists_sorted_and_hides_noise() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("src")).unwrap();
        std::fs::create_dir(dir.path().join(".git")).unwrap();
        std::fs::write(dir.path().join("zeta.md"), b"z").unwrap();
        std::fs::write(dir.path().join("alpha.txt"), b"a").unwrap();

        let entries = read_dir(dir.path().to_str().unwrap().to_string())
            .await
            .unwrap();
        let names: Vec<_> = entries.iter().map(|e| e.name.as_str()).collect();
        // .git hidden; dir first; then files alphabetically.
        assert_eq!(names, vec!["src", "alpha.txt", "zeta.md"]);
        assert!(entries[0].is_dir);
        assert!(!entries[1].is_dir);
    }

    #[tokio::test]
    async fn read_dir_errors_on_missing_path() {
        let dir = tempfile::tempdir().unwrap();
        let missing = dir.path().join("nope");
        let err = read_dir(missing.to_str().unwrap().to_string())
            .await
            .unwrap_err();
        assert!(err.contains("Failed to read dir"), "got: {err}");
    }

    #[test]
    fn is_directory_distinguishes_dirs_files_and_missing() {
        let dir = tempfile::tempdir().unwrap();
        assert!(is_directory(dir.path().to_str().unwrap().to_string()));

        let file = dir.path().join("note.md");
        std::fs::write(&file, b"hi").unwrap();
        assert!(!is_directory(file.to_str().unwrap().to_string()));

        let missing = dir.path().join("nope");
        assert!(!is_directory(missing.to_str().unwrap().to_string()));
    }

    #[test]
    fn canonicalize_resolves_dot_segments_and_errors_on_missing() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("sub");
        std::fs::create_dir(&sub).unwrap();

        // A path with a `..` segment resolves to the canonical parent dir.
        let messy = sub.join("..").to_string_lossy().to_string();
        let resolved = canonicalize(messy).unwrap();
        let expected = std::fs::canonicalize(dir.path())
            .unwrap()
            .to_string_lossy()
            .to_string();
        assert_eq!(resolved, expected);

        let missing = dir.path().join("ghost");
        assert!(canonicalize(missing.to_str().unwrap().to_string()).is_err());
    }

    #[tokio::test]
    async fn read_text_file_reads_text_and_rejects_binary() {
        let dir = tempfile::tempdir().unwrap();
        let text = dir.path().join("note.txt");
        std::fs::write(&text, b"hello world").unwrap();
        assert_eq!(
            read_text_file(text.to_str().unwrap().to_string())
                .await
                .unwrap(),
            "hello world"
        );

        let bin = dir.path().join("blob.bin");
        std::fs::write(&bin, [0u8, 1, 2, 3]).unwrap();
        assert_eq!(
            read_text_file(bin.to_str().unwrap().to_string())
                .await
                .unwrap_err(),
            "binary"
        );
    }

    #[test]
    fn rel_path_is_slash_joined_and_relative() {
        let root = Path::new("/root");
        assert_eq!(rel_path(root, Path::new("/root/a.md")), "a.md");
        assert_eq!(rel_path(root, Path::new("/root/sub/b.md")), "sub/b.md");
        // A path outside `root` falls back to the basename.
        assert_eq!(rel_path(root, Path::new("/other/c.md")), "c.md");
    }

    #[test]
    fn walk_files_respects_gitignore_and_skips_noise() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::write(root.join(".gitignore"), b"ignored.md\nbuild/\n").unwrap();
        std::fs::write(root.join("keep.md"), b"k").unwrap();
        std::fs::write(root.join("ignored.md"), b"i").unwrap();
        std::fs::create_dir(root.join("sub")).unwrap();
        std::fs::write(root.join("sub/nested.md"), b"n").unwrap();
        std::fs::create_dir(root.join("build")).unwrap();
        std::fs::write(root.join("build/out.md"), b"o").unwrap();
        std::fs::create_dir(root.join(".git")).unwrap();
        std::fs::write(root.join(".git/config"), b"c").unwrap();
        std::fs::create_dir(root.join("node_modules")).unwrap();
        std::fs::write(root.join("node_modules/dep.md"), b"d").unwrap();

        let files = walk_files(root);
        let rels: std::collections::HashSet<&str> = files.iter().map(|f| f.rel.as_str()).collect();

        assert!(rels.contains("keep.md"));
        assert!(rels.contains("sub/nested.md"));
        assert!(rels.contains(".gitignore")); // dotfiles are kept
        assert!(!rels.contains("ignored.md")); // gitignored file
        assert!(!rels.iter().any(|r| r.starts_with("build/"))); // gitignored dir
        assert!(!rels.iter().any(|r| r.starts_with(".git/"))); // noise dir
        assert!(!rels.iter().any(|r| r.starts_with("node_modules/"))); // noise dir
                                                                       // Names round-trip and there are no directory entries (basenames only on files).
        assert!(files.iter().any(|f| f.name == "keep.md"));
    }

    #[test]
    fn valid_filename_accepts_names_and_rejects_traversal() {
        assert!(is_valid_filename("note.md"));
        assert!(is_valid_filename("My Folder"));
        assert!(is_valid_filename("日本語.md"));
        assert!(!is_valid_filename(""));
        assert!(!is_valid_filename("   "));
        assert!(!is_valid_filename("."));
        assert!(!is_valid_filename(".."));
        assert!(!is_valid_filename("a/b"));
        assert!(!is_valid_filename("a\\b"));
        assert!(!is_valid_filename("a\0b"));
    }

    #[tokio::test]
    async fn create_file_makes_empty_file_and_rejects_duplicate() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("new.md");
        let ps = p.to_str().unwrap().to_string();
        create_file(ps.clone()).await.unwrap();
        assert_eq!(read_file(ps.clone()).await.unwrap(), "");
        assert!(create_file(ps).await.is_err()); // already exists
    }

    #[tokio::test]
    async fn create_file_rejects_invalid_name() {
        let dir = tempfile::tempdir().unwrap();
        let bad = dir.path().join(".."); // file_name() is None → invalid
        let err = create_file(bad.to_str().unwrap().to_string())
            .await
            .unwrap_err();
        assert!(err.contains("Invalid"), "got: {err}");
    }

    #[tokio::test]
    async fn create_dir_makes_dir_and_rejects_duplicate() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("folder");
        let ps = p.to_str().unwrap().to_string();
        create_dir(ps.clone()).await.unwrap();
        assert!(p.is_dir());
        assert!(create_dir(ps).await.is_err());
    }

    #[tokio::test]
    async fn rename_path_moves_and_rejects_existing_target() {
        let dir = tempfile::tempdir().unwrap();
        let from = dir.path().join("a.md");
        let to = dir.path().join("b.md");
        std::fs::write(&from, b"x").unwrap();
        rename_path(
            from.to_str().unwrap().to_string(),
            to.to_str().unwrap().to_string(),
        )
        .await
        .unwrap();
        assert!(!from.exists());
        assert!(to.exists());

        // Renaming another file onto the now-existing target errors (no overwrite).
        let other = dir.path().join("c.md");
        std::fs::write(&other, b"y").unwrap();
        let err = rename_path(
            other.to_str().unwrap().to_string(),
            to.to_str().unwrap().to_string(),
        )
        .await
        .unwrap_err();
        assert!(err.contains("already exists"), "got: {err}");
    }
}
