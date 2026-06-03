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
                    // Emit the largest valid UTF-8 prefix; keep the trailing
                    // incomplete bytes for the next read.
                    let valid_len = match std::str::from_utf8(&pending) {
                        Ok(s) => s.len(),
                        Err(e) => e.valid_up_to(),
                    };
                    if valid_len > 0 {
                        let data = String::from_utf8_lossy(&pending[..valid_len]).to_string();
                        let _ = handle.emit(
                            "terminal-output",
                            TerminalOutputPayload {
                                session_id: sid,
                                data,
                            },
                        );
                        pending.drain(..valid_len);
                    }
                    // Safety valve: a valid UTF-8 char is at most 4 bytes, so if
                    // leftover bytes exceed that they're genuinely invalid —
                    // flush lossily rather than stall.
                    if pending.len() > 4 {
                        let data = String::from_utf8_lossy(&pending).to_string();
                        let _ = handle.emit(
                            "terminal-output",
                            TerminalOutputPayload {
                                session_id: sid,
                                data,
                            },
                        );
                        pending.clear();
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
