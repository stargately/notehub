// Adds a path to macOS' "Recent Documents" list, which surfaces in the Dock
// right-click menu (and File → Open Recent if the app had one). On other
// platforms this is a no-op.
//
// AppKit's NSDocumentController is main-thread-only, so we dispatch via
// Tauri's main-thread runner.

use tauri::AppHandle;

#[cfg(target_os = "macos")]
pub fn note(app: &AppHandle, path: String) {
    let _ = app.run_on_main_thread(move || {
        use objc2::rc::autoreleasepool;
        use objc2::MainThreadMarker;
        use objc2_app_kit::NSDocumentController;
        use objc2_foundation::{NSString, NSURL};

        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        autoreleasepool(|_| {
            let ns_path = NSString::from_str(&path);
            let url = NSURL::fileURLWithPath(&ns_path);
            let controller = NSDocumentController::sharedDocumentController(mtm);
            controller.noteNewRecentDocumentURL(&url);
        });
    });
}

#[cfg(not(target_os = "macos"))]
pub fn note(_app: &AppHandle, _path: String) {}
