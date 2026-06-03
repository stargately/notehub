use notify::RecursiveMode;
use notify_debouncer_full::new_debouncer;
use serde::Serialize;
use std::path::Path;
use std::sync::mpsc::channel;
use std::time::Duration;
use tauri::Emitter;

#[derive(Clone, Serialize)]
pub struct FileChangedPayload {
    pub path: String,
    pub kind: String,
}

/// Whether a changed path should be ignored. Now that the workspace tree surfaces every file
/// type (not just markdown), the watcher reports all files so non-`.md` editors reload too —
/// except our own atomic-write temp files (`.tmp`) and anything inside a noise directory
/// (`.git`, `node_modules`, …; reuses `commands::is_noise_dir`).
fn should_skip_path(path: &str) -> bool {
    if path.ends_with(".tmp") {
        return true;
    }
    Path::new(path).components().any(|c| {
        matches!(c, std::path::Component::Normal(name)
            if crate::commands::is_noise_dir(&name.to_string_lossy()))
    })
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

/// Start a recursive, debounced watcher on `dir` (blocks until the channel disconnects).
///
/// Like VS Code's watcher, this *coalesces* a burst of filesystem events over a short window
/// and then emits every distinct change — it never drops events to rate-limit (the old global
/// debounce could swallow a `create` that landed right after an unrelated `modify`). Uses
/// `notify-debouncer-full`, which also tracks renames so both the old and new paths surface.
pub fn start_watcher(app: &tauri::AppHandle, dir: &str) -> Result<(), String> {
    let (tx, rx) = channel();

    let mut debouncer = new_debouncer(Duration::from_millis(300), None, tx)
        .map_err(|e| format!("Failed to create watcher: {}", e))?;

    debouncer
        .watch(Path::new(dir), RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch directory: {}", e))?;

    // Blocks here until all senders drop (i.e. the debouncer above is dropped).
    for result in rx {
        let events = match result {
            Ok(events) => events,
            Err(_errors) => continue,
        };
        for event in events {
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
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{event_kind_label, should_skip_path};
    use notify::event::{AccessKind, CreateKind, ModifyKind, RemoveKind};
    use notify::EventKind;

    #[test]
    fn keeps_all_file_types() {
        // The tree shows every file type, so the watcher surfaces them all.
        assert!(!should_skip_path("/notes/todo.md"));
        assert!(!should_skip_path("a.md"));
        assert!(!should_skip_path("/notes/todo.txt"));
        assert!(!should_skip_path("/proj/src/main.rs"));
        assert!(!should_skip_path("/notes/todo")); // extensionless still tracked
    }

    #[test]
    fn skips_temp_and_noise_dir_paths() {
        assert!(should_skip_path("/notes/todo.md.tmp"));
        assert!(should_skip_path("/repo/.git/index"));
        // A .md file living under a .git dir is still skipped.
        assert!(should_skip_path("/repo/.git/notes.md"));
        // node_modules is noise too.
        assert!(should_skip_path("/proj/node_modules/lib/index.js"));
        // ".git" must be a full path component, not a substring of a real name.
        assert!(!should_skip_path("/notes/my.git.notes.md"));
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
}
