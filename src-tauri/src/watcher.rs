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

/// Whether a changed path should be ignored: NoteHub only cares about `.md` files, and never
/// about its own atomic-write temp files (`.tmp`) or anything under a `.git` directory.
fn should_skip_path(path: &str) -> bool {
    path.ends_with(".tmp") || path.contains(".git") || !path.ends_with(".md")
}

/// Map a filesystem event kind to the label sent to the frontend, or `None` for kinds we
/// don't surface (e.g. access/metadata-only events).
fn event_kind_label(kind: &notify::EventKind) -> Option<&'static str> {
    match kind {
        notify::EventKind::Create(_) => Some("created"),
        notify::EventKind::Modify(_) => Some("modified"),
        notify::EventKind::Remove(_) => Some("deleted"),
        _ => None,
    }
}

/// Whether an event arriving at `now` should be dropped because the previous emitted event
/// was less than `window` ago (coalesces editor save bursts into one reload).
fn is_debounced(last: Option<Instant>, now: Instant, window: Duration) -> bool {
    match last {
        Some(last) => now.duration_since(last) < window,
        None => false,
    }
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
                if is_debounced(last_event, now, debounce) {
                    continue;
                }
                last_event = Some(now);

                let kind = match event_kind_label(&event.kind) {
                    Some(k) => k,
                    None => continue,
                };

                for path in &event.paths {
                    let path_str = path.to_string_lossy().to_string();
                    if should_skip_path(&path_str) {
                        continue;
                    }

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

#[cfg(test)]
mod tests {
    use super::{event_kind_label, is_debounced, should_skip_path};
    use notify::event::{AccessKind, CreateKind, ModifyKind, RemoveKind};
    use notify::EventKind;
    use std::time::{Duration, Instant};

    #[test]
    fn keeps_markdown_paths() {
        assert!(!should_skip_path("/notes/todo.md"));
        assert!(!should_skip_path("a.md"));
    }

    #[test]
    fn skips_non_markdown_temp_and_git_paths() {
        assert!(should_skip_path("/notes/todo.txt"));
        assert!(should_skip_path("/notes/todo.md.tmp"));
        assert!(should_skip_path("/repo/.git/index"));
        // A .md file living under a .git dir is still skipped.
        assert!(should_skip_path("/repo/.git/notes.md"));
        // Extensionless paths are not markdown.
        assert!(should_skip_path("/notes/todo"));
    }

    #[test]
    fn labels_surfaced_event_kinds() {
        assert_eq!(
            event_kind_label(&EventKind::Create(CreateKind::File)),
            Some("created")
        );
        assert_eq!(
            event_kind_label(&EventKind::Modify(ModifyKind::Any)),
            Some("modified")
        );
        assert_eq!(
            event_kind_label(&EventKind::Remove(RemoveKind::File)),
            Some("deleted")
        );
    }

    #[test]
    fn ignores_unsurfaced_event_kinds() {
        assert_eq!(event_kind_label(&EventKind::Access(AccessKind::Any)), None);
        assert_eq!(event_kind_label(&EventKind::Any), None);
    }

    #[test]
    fn debounce_lets_the_first_event_through() {
        assert!(!is_debounced(
            None,
            Instant::now(),
            Duration::from_millis(500)
        ));
    }

    #[test]
    fn debounce_drops_events_inside_the_window() {
        let window = Duration::from_millis(500);
        let last = Instant::now();
        let now = last + Duration::from_millis(100);
        assert!(is_debounced(Some(last), now, window));
    }

    #[test]
    fn debounce_allows_events_past_the_window() {
        let window = Duration::from_millis(500);
        let last = Instant::now();
        let now = last + Duration::from_millis(600);
        assert!(!is_debounced(Some(last), now, window));
    }
}
