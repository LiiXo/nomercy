#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod hardware;
mod api;
mod store;
mod commands;

fn main() {
    tauri::Builder::default()
        .setup(|_app| {
            println!("[Iris] Application started");
            println!("[Iris] Version: 1.0.0");
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_discord_auth,
            commands::verify_session,
            commands::logout,
            commands::get_hardware_id,
            commands::start_heartbeat,
            commands::stop_heartbeat,
            commands::window_minimize,
            commands::window_close,
            commands::open_external,
            commands::check_tpm,
            commands::get_security_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
