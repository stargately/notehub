//! Native application menu (macOS top menu bar). Built in Rust from the platform default so the
//! standard App / **Edit** / View / Window / Help menus stay intact (Edit drives Copy/Paste/Undo
//! in Milkdown/Monaco/inputs). We swap the stock "File" submenu for our own and route its clicks
//! to the focused window as `menu:*` events, which the React app handles (see `useNativeMenu`).

use crate::AppState;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, Wry};

/// Pure mapping of a File menu item id → the window event the focused window listens for.
/// Returns `None` for App/Edit/predefined ids, which we let the OS handle natively. Extracted as a
/// pure fn (repo convention) so it can be unit-tested without an `AppHandle`.
pub fn menu_event_name(id: &str) -> Option<&'static str> {
    match id {
        "file::new-file" => Some("menu:new-file"),
        "file::new-folder" => Some("menu:new-folder"),
        "file::open-file" => Some("menu:open-file"),
        "file::open-folder" => Some("menu:open-folder"),
        "file::quick-open" => Some("menu:quick-open"),
        "file::save" => Some("menu:save"),
        "file::refresh-tree" => Some("menu:refresh-tree"),
        "file::open-keymap" => Some("menu:open-keymap"),
        _ => None,
    }
}

/// Handles for the File items whose enabled state tracks the focused window (see `update_file_menu`).
/// `MenuItem` is a cheap clonable handle pointing at the live native item.
pub struct FileMenuItems {
    pub new_file: MenuItem<Wry>,
    pub new_folder: MenuItem<Wry>,
    pub refresh: MenuItem<Wry>,
    pub save: MenuItem<Wry>,
}

/// Build the app menu: start from the platform default (keeps App/Edit/View/Window/Help) and swap
/// the stock File submenu for ours. macOS' default already has a File submenu at index 1 (just
/// Close Window), so we remove that index and insert ours there — re-adding Close Window so ⌘W
/// still works. Returns the menu plus handles for the dynamically-enabled items.
pub fn build_app_menu(app: &AppHandle) -> tauri::Result<(Menu<Wry>, FileMenuItems)> {
    let new_file = MenuItem::with_id(app, "file::new-file", "New File", true, None::<&str>)?;
    let new_folder = MenuItem::with_id(app, "file::new-folder", "New Folder", true, None::<&str>)?;
    let open_file = MenuItem::with_id(
        app,
        "file::open-file",
        "Open File…",
        true,
        Some("CmdOrCtrl+O"),
    )?;
    let open_folder =
        MenuItem::with_id(app, "file::open-folder", "Open Folder…", true, None::<&str>)?;
    let quick_open = MenuItem::with_id(
        app,
        "file::quick-open",
        "Quick Open…",
        true,
        Some("CmdOrCtrl+P"),
    )?;
    let save = MenuItem::with_id(app, "file::save", "Save", true, Some("CmdOrCtrl+S"))?;
    let refresh = MenuItem::with_id(
        app,
        "file::refresh-tree",
        "Refresh File Tree",
        true,
        None::<&str>,
    )?;
    let open_keymap = MenuItem::with_id(
        app,
        "file::open-keymap",
        "Keyboard Shortcuts…",
        true,
        None::<&str>,
    )?;

    let file = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &new_file,
            &new_folder,
            &PredefinedMenuItem::separator(app)?,
            &open_file,
            &open_folder,
            &PredefinedMenuItem::separator(app)?,
            &quick_open,
            &PredefinedMenuItem::separator(app)?,
            &save,
            &PredefinedMenuItem::separator(app)?,
            &refresh,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &open_keymap,
        ],
    )?;

    let menu = Menu::default(app)?;
    // macOS default order: [App(0), File(1), Edit(2), View, Window, Help]; elsewhere File is first.
    #[cfg(target_os = "macos")]
    let file_idx = 1;
    #[cfg(not(target_os = "macos"))]
    let file_idx = 0;
    let _ = menu.remove_at(file_idx)?;
    menu.insert(&file, file_idx)?;

    Ok((
        menu,
        FileMenuItems {
            new_file,
            new_folder,
            refresh,
            save,
        },
    ))
}

/// Route a menu click to the focused window as a `menu:*` event. App/Edit/predefined items return
/// `None` from `menu_event_name` and are handled natively. Falls back to the main window, then no-op.
pub fn handle_menu_event(app: &AppHandle, id: &str) {
    let Some(event) = menu_event_name(id) else {
        return;
    };
    let target = app
        .webview_windows()
        .into_values()
        .find(|w| w.is_focused().unwrap_or(false))
        .or_else(|| app.get_webview_window("main"));
    if let Some(win) = target {
        let _ = win.emit(event, ());
    }
}

/// Toggle the enabled state of the focus-dependent File items to match the focused window.
pub fn set_file_menu_enabled(state: &AppState, has_workspace: bool, can_save: bool) {
    if let Ok(guard) = state.file_menu.lock() {
        if let Some(items) = guard.as_ref() {
            let _ = items.new_file.set_enabled(has_workspace);
            let _ = items.new_folder.set_enabled(has_workspace);
            let _ = items.refresh.set_enabled(has_workspace);
            let _ = items.save.set_enabled(can_save);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::menu_event_name;

    #[test]
    fn maps_known_file_ids_to_events() {
        assert_eq!(menu_event_name("file::save"), Some("menu:save"));
        assert_eq!(menu_event_name("file::new-file"), Some("menu:new-file"));
        assert_eq!(
            menu_event_name("file::open-keymap"),
            Some("menu:open-keymap")
        );
        assert_eq!(
            menu_event_name("file::refresh-tree"),
            Some("menu:refresh-tree")
        );
    }

    #[test]
    fn ignores_unknown_and_predefined_ids() {
        assert_eq!(menu_event_name("edit::copy"), None);
        assert_eq!(menu_event_name("file::nope"), None);
        assert_eq!(menu_event_name(""), None);
    }
}
