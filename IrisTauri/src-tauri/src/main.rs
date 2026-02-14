#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod hardware;
mod api;
mod store;
mod commands;
mod updater;

use tauri::{Manager, Emitter};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus the existing window when another instance is launched
            println!("[Iris] Second instance detected - focusing existing window");
            if let Some(window) = app.get_webview_window("main") {
                // Show window if hidden (in tray)
                let _ = window.show();
                // Unminimize if minimized
                let _ = window.unminimize();
                // Bring to front and focus
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            println!("[Iris] Application started");
            println!("[Iris] Version: {}", updater::get_current_version());
            
            // Check for updates on startup
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Wait a bit for the app to fully initialize
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                
                println!("[Iris] Checking for updates on startup...");
                if let Ok(update_info) = updater::check_for_updates(app_handle.clone()).await {
                    if update_info.available {
                        println!("[Iris] Update available: {:?}", update_info.version);
                        // Emit event to UI
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.emit("update-available", &update_info);
                        }
                    }
                }
            });
            
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
            updater::check_for_updates,
            updater::install_update,
            updater::get_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
