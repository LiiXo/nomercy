//! Auto-updater module for Iris (Tauri v2)
//! Handles checking for updates and installing them

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateInfo {
    pub available: bool,
    pub version: Option<String>,
    pub changelog: Option<String>,
    pub mandatory: bool,
    pub download_url: Option<String>,
}

/// Get current app version
pub fn get_current_version() -> &'static str {
    CURRENT_VERSION
}

/// Check for updates from the server
#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<UpdateInfo, String> {
    println!("[Iris Updater] Checking for updates... Current version: {}", CURRENT_VERSION);
    
    // Use Tauri's built-in updater plugin
    let updater = app.updater().map_err(|e| format!("Failed to get updater: {}", e))?;
    
    match updater.check().await {
        Ok(Some(update)) => {
            println!("[Iris Updater] Update available: {}", update.version);
            
            Ok(UpdateInfo {
                available: true,
                version: Some(update.version.clone()),
                changelog: update.body.clone(),
                mandatory: true, // All updates are mandatory
                download_url: None, // Handled by Tauri
            })
        }
        Ok(None) => {
            println!("[Iris Updater] No update available");
            Ok(UpdateInfo {
                available: false,
                version: None,
                changelog: None,
                mandatory: false,
                download_url: None,
            })
        }
        Err(e) => {
            println!("[Iris Updater] Error checking for updates: {}", e);
            Err(format!("Failed to check for updates: {}", e))
        }
    }
}

/// Download and install update, then restart
#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    println!("[Iris Updater] Starting update installation...");
    
    let updater = app.updater().map_err(|e| format!("Failed to get updater: {}", e))?;
    
    match updater.check().await {
        Ok(Some(update)) => {
            println!("[Iris Updater] Downloading update {}...", update.version);
            
            // Download and install
            let mut downloaded: usize = 0;
            
            match update.download_and_install(
                |chunk_length, content_length| {
                    downloaded += chunk_length;
                    if let Some(total) = content_length {
                        let percent = (downloaded as f64 / total as f64 * 100.0) as u32;
                        println!("[Iris Updater] Download progress: {}%", percent);
                    }
                },
                || {
                    println!("[Iris Updater] Download complete, installing...");
                }
            ).await {
                Ok(_) => {
                    println!("[Iris Updater] Update installed successfully, restarting...");
                    // Restart the app - this never returns
                    app.restart();
                    #[allow(unreachable_code)]
                    Ok(())
                }
                Err(e) => {
                    println!("[Iris Updater] Failed to install update: {}", e);
                    Err(format!("Failed to install update: {}", e))
                }
            }
        }
        Ok(None) => {
            Err("No update available".to_string())
        }
        Err(e) => {
            Err(format!("Failed to check for updates: {}", e))
        }
    }
}

/// Get current version
#[tauri::command]
pub fn get_version() -> String {
    CURRENT_VERSION.to_string()
}
