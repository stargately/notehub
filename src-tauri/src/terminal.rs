use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::Emitter;

pub struct TerminalSession {
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
}

pub struct TerminalState {
    pub sessions: Mutex<HashMap<u32, TerminalSession>>,
    pub next_id: Mutex<u32>,
}

impl Default for TerminalState {
    fn default() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            next_id: Mutex::new(1),
        }
    }
}

impl TerminalState {
    pub fn new() -> Self {
        Self::default()
    }
}

#[derive(Clone, Serialize)]
pub struct TerminalOutputPayload {
    pub session_id: u32,
    pub data: String,
}

#[derive(Clone, Serialize)]
pub struct TerminalExitPayload {
    pub session_id: u32,
}

/// Drain the largest decodable prefix from a stream of PTY bytes, mutating `pending` to keep
/// only the trailing bytes that still need more input.
///
/// A multi-byte UTF-8 char can be split across `read()` chunks; decoding the partial bytes
/// would render as `�`. So we emit the largest valid UTF-8 prefix and retain the incomplete
/// tail for the next read. A valid UTF-8 char is at most 4 bytes, so if more than 4 bytes
/// remain after taking the valid prefix they are genuinely invalid — flush them lossily as a
/// safety valve rather than stall the stream. Returns `None` when there is nothing to emit yet.
fn drain_utf8(pending: &mut Vec<u8>) -> Option<String> {
    let mut out = String::new();

    let valid_len = match std::str::from_utf8(pending) {
        Ok(s) => s.len(),
        Err(e) => e.valid_up_to(),
    };
    if valid_len > 0 {
        out.push_str(&String::from_utf8_lossy(&pending[..valid_len]));
        pending.drain(..valid_len);
    }

    if pending.len() > 4 {
        out.push_str(&String::from_utf8_lossy(pending));
        pending.clear();
    }

    if out.is_empty() {
        None
    } else {
        Some(out)
    }
}

pub fn spawn(
    state: &TerminalState,
    app_handle: tauri::AppHandle,
    cwd: Option<String>,
) -> Result<u32, String> {
    let pty_system = native_pty_system();

    let size = PtySize {
        rows: 24,
        cols: 80,
        pixel_width: 0,
        pixel_height: 0,
    };

    let pair = pty_system
        .openpty(size)
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let mut cmd = CommandBuilder::new(&shell);
    cmd.arg("-l"); // login shell
                   // Advertise a color-capable terminal. A Tauri app launched from Finder/Dock
                   // inherits no TERM, so the shell and tools would otherwise suppress color.
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    if let Some(ref dir) = cwd {
        cmd.cwd(dir);
    }

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get PTY writer: {}", e))?;

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to get PTY reader: {}", e))?;

    let mut id_lock = state.next_id.lock().map_err(|e| e.to_string())?;
    let session_id = *id_lock;
    *id_lock += 1;
    drop(id_lock);

    let session = TerminalSession {
        writer,
        child,
        master: pair.master,
    };

    state
        .sessions
        .lock()
        .map_err(|e| e.to_string())?
        .insert(session_id, session);

    // Spawn reader thread to stream PTY output to the frontend
    let handle = app_handle.clone();
    let sid = session_id;
    std::thread::spawn(move || {
        // Accumulate bytes so a multi-byte UTF-8 char split across read() chunks
        // isn't decoded as `�`. ANSI escape codes are ASCII and always survive;
        // this protects box-drawing glyphs, powerline symbols, emoji, accents.
        let mut pending: Vec<u8> = Vec::new();
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    pending.extend_from_slice(&buf[..n]);
                    if let Some(data) = drain_utf8(&mut pending) {
                        let _ = handle.emit(
                            "terminal-output",
                            TerminalOutputPayload {
                                session_id: sid,
                                data,
                            },
                        );
                    }
                }
                Err(_) => break,
            }
        }
        let _ = handle.emit("terminal-exit", TerminalExitPayload { session_id: sid });
    });

    Ok(session_id)
}

pub fn write(state: &TerminalState, session_id: u32, data: &str) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| format!("No terminal session {}", session_id))?;
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to PTY: {}", e))?;
    session
        .writer
        .flush()
        .map_err(|e| format!("Failed to flush PTY: {}", e))?;
    Ok(())
}

pub fn resize(state: &TerminalState, session_id: u32, cols: u16, rows: u16) -> Result<(), String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("No terminal session {}", session_id))?;
    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to resize PTY: {}", e))?;
    Ok(())
}

pub fn kill(state: &TerminalState, session_id: u32) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = sessions.remove(&session_id) {
        let _ = session.child.kill();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{drain_utf8, kill, resize, write, TerminalState};

    #[test]
    fn write_to_unknown_session_errors() {
        let state = TerminalState::new();
        let err = write(&state, 99, "data").unwrap_err();
        assert!(err.contains("No terminal session 99"), "got: {err}");
    }

    #[test]
    fn resize_unknown_session_errors() {
        let state = TerminalState::new();
        let err = resize(&state, 99, 80, 24).unwrap_err();
        assert!(err.contains("No terminal session 99"), "got: {err}");
    }

    #[test]
    fn kill_unknown_session_is_a_noop_ok() {
        let state = TerminalState::new();
        // Killing a session that was never spawned must not error.
        assert!(kill(&state, 99).is_ok());
    }

    #[test]
    fn passes_ascii_through_and_empties_buffer() {
        let mut pending = b"hello world".to_vec();
        assert_eq!(drain_utf8(&mut pending).as_deref(), Some("hello world"));
        assert!(pending.is_empty());
    }

    #[test]
    fn returns_none_for_empty_buffer() {
        let mut pending: Vec<u8> = Vec::new();
        assert_eq!(drain_utf8(&mut pending), None);
    }

    #[test]
    fn reassembles_a_multibyte_char_split_across_chunks() {
        // "😀" is F0 9F 98 80 — feed it two bytes at a time.
        let mut pending = vec![0xF0, 0x9F];
        // Only an incomplete prefix so far: nothing decodable, bytes retained.
        assert_eq!(drain_utf8(&mut pending), None);
        assert_eq!(pending, vec![0xF0, 0x9F]);

        pending.extend_from_slice(&[0x98, 0x80]);
        assert_eq!(drain_utf8(&mut pending).as_deref(), Some("😀"));
        assert!(pending.is_empty());
    }

    #[test]
    fn emits_valid_prefix_and_retains_dangling_continuation() {
        // "A" followed by the first byte of a 3-byte char (E2 ...).
        let mut pending = vec![0x41, 0xE2];
        assert_eq!(drain_utf8(&mut pending).as_deref(), Some("A"));
        // The lone lead byte is below the 4-byte safety valve, so it is retained.
        assert_eq!(pending, vec![0xE2]);
    }

    #[test]
    fn safety_valve_flushes_invalid_bytes_past_four() {
        // Five invalid bytes can never form a valid char — flush lossily, don't stall.
        let mut pending = vec![0xFF, 0xFF, 0xFF, 0xFF, 0xFF];
        let out = drain_utf8(&mut pending).expect("safety valve should emit");
        assert_eq!(out.chars().filter(|&c| c == '\u{FFFD}').count(), 5);
        assert!(pending.is_empty());
    }
}
