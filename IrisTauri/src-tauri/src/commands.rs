//! Tauri commands - exposed to frontend via invoke()

use crate::{api, hardware, store};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Window};

static HEARTBEAT_RUNNING: AtomicBool = AtomicBool::new(false);
static SCAN_MODE_ENABLED: AtomicBool = AtomicBool::new(false);

// Store previous security status to detect changes
lazy_static::lazy_static! {
    static ref PREVIOUS_SECURITY: Mutex<Option<hardware::SecurityStatus>> = Mutex::new(None);
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResult {
    pub success: bool,
    pub message: Option<String>,
    pub user: Option<UserData>,
    #[serde(rename = "hardwareId")]
    pub hardware_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserData {
    pub id: String,
    pub username: String,
    #[serde(rename = "discordId")]
    pub discord_id: Option<String>,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TpmResult {
    pub available: bool,
    pub version: Option<String>,
    pub manufacturer: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionResult {
    pub success: bool,
    pub user: Option<UserData>,
    pub reason: Option<String>,
    pub message: Option<String>,
}

/// Start Discord OAuth authentication
#[tauri::command]
pub async fn start_discord_auth(_window: Window) -> Result<AuthResult, String> {
    println!("[Iris] Starting Discord authentication...");
    
    // Check TPM first
    let tpm = hardware::check_tpm();
    if !tpm.present {
        return Ok(AuthResult {
            success: false,
            message: Some("TPM 2.0 est désactivé ou non disponible sur votre système.\n\nVeuillez activer le TPM dans les paramètres BIOS/UEFI de votre PC pour utiliser Iris.".to_string()),
            user: None,
            hardware_id: None,
        });
    }
    
    // Open Discord OAuth in browser
    let is_dev = cfg!(debug_assertions);
    let auth_url = api::get_discord_auth_url(is_dev);
    
    if let Err(e) = open::that(&auth_url) {
        return Err(format!("Failed to open browser: {}", e));
    }
    
    Ok(AuthResult {
        success: true,
        message: Some("Browser opened for authentication".to_string()),
        user: None,
        hardware_id: None,
    })
}

/// Verify existing session
#[tauri::command]
pub async fn verify_session() -> Result<SessionResult, String> {
    println!("[Iris] Verifying session...");
    
    // Check TPM first
    let tpm = hardware::check_tpm();
    println!("[Iris] TPM check: present={}, enabled={}", tpm.present, tpm.enabled);
    
    if !tpm.present {
        let _ = store::clear_all();
        return Ok(SessionResult {
            success: false,
            user: None,
            reason: Some("tpm_disabled".to_string()),
            message: Some("TPM 2.0 est désactivé ou non disponible sur votre système.\n\nVeuillez activer le TPM dans les paramètres BIOS/UEFI de votre PC pour utiliser Iris.".to_string()),
        });
    }
    
    // Check for stored session
    let token = match store::get_token() {
        Some(t) => t,
        None => {
            return Ok(SessionResult {
                success: false,
                user: None,
                reason: Some("no_session".to_string()),
                message: None,
            });
        }
    };
    
    let user = match store::get_user() {
        Some(u) => u,
        None => {
            return Ok(SessionResult {
                success: false,
                user: None,
                reason: Some("no_session".to_string()),
                message: None,
            });
        }
    };
    
    // Verify with server
    let is_dev = cfg!(debug_assertions);
    let api_client = api::IrisApiClient::new(is_dev);
    
    match api_client.verify_token(&token).await {
        Ok(response) => {
            if response.success {
                println!("[Iris] Session verified for: {}", user.username);
                
                // IMMEDIATELY send security status on connection
                let security = hardware::get_full_security_status();
                let hardware_id = hardware::generate_hardware_id();
                
                // Store initial security status for change detection
                if let Ok(mut prev) = PREVIOUS_SECURITY.lock() {
                    *prev = Some(security.clone());
                }
                
                // Send initial security status to API (for admin panel)
                let security_json = serde_json::json!({
                    "tpm": security.tpm,
                    "secureBoot": security.secure_boot.enabled,
                    "virtualization": security.virtualization.enabled,
                    "vbs": security.vbs.enabled,
                    "hvci": security.vbs.hvci_enabled,
                    "defender": security.defender.enabled
                });
                
                let _ = api_client.send_heartbeat(
                    &token,
                    &hardware_id,
                    security_json,
                    None // No process/USB scan on initial connection
                ).await;
                
                Ok(SessionResult {
                    success: true,
                    user: Some(UserData {
                        id: user.user_id,
                        username: user.username,
                        discord_id: Some(user.discord_id),
                        avatar_url: user.avatar_url,
                    }),
                    reason: None,
                    message: None,
                })
            } else {
                let _ = store::clear_all();
                Ok(SessionResult {
                    success: false,
                    user: None,
                    reason: Some("invalid_session".to_string()),
                    message: response.message,
                })
            }
        }
        Err(e) => {
            if e.contains("ECONNREFUSED") || e.contains("timeout") {
                println!("[Iris] Server unreachable, using cached session");
                Ok(SessionResult {
                    success: true,
                    user: Some(UserData {
                        id: user.user_id,
                        username: user.username,
                        discord_id: Some(user.discord_id),
                        avatar_url: user.avatar_url,
                    }),
                    reason: None,
                    message: None,
                })
            } else {
                let _ = store::clear_all();
                Ok(SessionResult {
                    success: false,
                    user: None,
                    reason: Some("server_error".to_string()),
                    message: Some(e),
                })
            }
        }
    }
}

/// Logout
#[tauri::command]
pub async fn logout() -> Result<(), String> {
    println!("[Iris] Logging out...");
    stop_heartbeat().await?;
    store::clear_all()
}

/// Get hardware ID
#[tauri::command]
pub async fn get_hardware_id() -> Result<String, String> {
    Ok(hardware::generate_hardware_id())
}

/// Check if security status has changed
fn has_security_changed(current: &hardware::SecurityStatus, previous: &hardware::SecurityStatus) -> Vec<String> {
    let mut changes = Vec::new();
    
    if current.tpm.present != previous.tpm.present {
        changes.push(format!("TPM: {} → {}", previous.tpm.present, current.tpm.present));
    }
    if current.tpm.enabled != previous.tpm.enabled {
        changes.push(format!("TPM Enabled: {} → {}", previous.tpm.enabled, current.tpm.enabled));
    }
    if current.secure_boot.enabled != previous.secure_boot.enabled {
        changes.push(format!("Secure Boot: {} → {}", previous.secure_boot.enabled, current.secure_boot.enabled));
    }
    if current.virtualization.enabled != previous.virtualization.enabled {
        changes.push(format!("Virtualization: {} → {}", previous.virtualization.enabled, current.virtualization.enabled));
    }
    if current.vbs.enabled != previous.vbs.enabled {
        changes.push(format!("VBS: {} → {}", previous.vbs.enabled, current.vbs.enabled));
    }
    if current.vbs.hvci_enabled != previous.vbs.hvci_enabled {
        changes.push(format!("HVCI: {} → {}", previous.vbs.hvci_enabled, current.vbs.hvci_enabled));
    }
    if current.defender.enabled != previous.defender.enabled {
        changes.push(format!("Defender: {} → {}", previous.defender.enabled, current.defender.enabled));
    }
    
    changes
}

/// Start heartbeat (ping every 2 min for alive signal, data every 5 min)
#[tauri::command]
pub async fn start_heartbeat(app: AppHandle) -> Result<(), String> {
    if HEARTBEAT_RUNNING.load(Ordering::SeqCst) {
        return Ok(());
    }
    
    HEARTBEAT_RUNNING.store(true, Ordering::SeqCst);
    println!("[Iris] Starting heartbeat (ping every 2 min, data every 5 min)...");
    
    let is_dev = cfg!(debug_assertions);
    
    tokio::spawn(async move {
        let api_client = api::IrisApiClient::new(is_dev);
        let mut cycle_count: u32 = 0;
        
        loop {
            if !HEARTBEAT_RUNNING.load(Ordering::SeqCst) {
                break;
            }
            
            // Wait 2 minutes between each cycle
            tokio::time::sleep(tokio::time::Duration::from_secs(120)).await;
            
            if !HEARTBEAT_RUNNING.load(Ordering::SeqCst) {
                break;
            }
            
            cycle_count += 1;
            
            let token = match store::get_token() {
                Some(t) => t,
                None => {
                    println!("[Iris Heartbeat] No session, stopping");
                    break;
                }
            };
            
            // Send ping every 2 minutes (alive signal)
            match api_client.send_ping(&token).await {
                Ok(response) => {
                    println!("[Iris Ping] Sent (cycle {})", cycle_count);
                    
                    // Check if server enabled/disabled scan mode
                    if let Some(data) = response.data {
                        if let Some(scan) = data.get("scanModeEnabled") {
                            if let Some(enabled) = scan.as_bool() {
                                SCAN_MODE_ENABLED.store(enabled, Ordering::SeqCst);
                                if enabled {
                                    println!("[Iris Ping] Scan mode enabled by server");
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    println!("[Iris Ping] Error: {}", e);
                }
            }
            
            // Every 5 minutes (cycle 3, 6, 9...) or if scan mode enabled, send full heartbeat
            // Note: cycle 3 = 6 min, but we want 5 min, so use cycle 2 or 3
            // Actually: cycle 1 = 2min, cycle 2 = 4min, cycle 3 = 6min
            // Let's send data at 2.5 cycles = every 5 min, so we send at odd cycles after first
            // Simplest: send data every 2-3 cycles (4-6 min)
            let scan_mode = SCAN_MODE_ENABLED.load(Ordering::SeqCst);
            let should_send_data = cycle_count % 3 == 0 || scan_mode; // Every ~6 min or if scan mode
            
            if should_send_data {
                // Get current security status
                let security = hardware::get_full_security_status();
                let hardware_id = hardware::generate_hardware_id();
                
                // Check for security state changes
                let security_changes = {
                    let prev_guard = PREVIOUS_SECURITY.lock();
                    if let Ok(prev) = prev_guard {
                        if let Some(ref previous) = *prev {
                            has_security_changed(&security, previous)
                        } else {
                            Vec::new()
                        }
                    } else {
                        Vec::new()
                    }
                };
                
                // Update stored previous status
                if let Ok(mut prev) = PREVIOUS_SECURITY.lock() {
                    *prev = Some(security.clone());
                }
                
                // Build security JSON
                let security_json = serde_json::json!({
                    "tpm": security.tpm,
                    "secureBoot": security.secure_boot.enabled,
                    "virtualization": security.virtualization.enabled,
                    "vbs": security.vbs.enabled,
                    "hvci": security.vbs.hvci_enabled,
                    "defender": security.defender.enabled
                });
                
                // Build system info (only if scan mode enabled)
                let system_info = if scan_mode {
                    let cheat_detection = hardware::detect_cheats();
                    
                    // If cheat detected, it will be handled server-side (shadow ban)
                    if cheat_detection.found {
                        println!("[Iris Heartbeat] CHEAT DETECTED: {:?}", cheat_detection);
                        if let Some(window) = app.get_window("main") {
                            let _ = window.emit("cheat-detected", &cheat_detection);
                        }
                    }
                    
                    // Capture screenshots of all monitors
                    println!("[Iris Heartbeat] Scan mode enabled, capturing screenshots...");
                    let screenshots = hardware::capture_all_screens();
                    println!("[Iris Heartbeat] Captured {} screenshot(s)", screenshots.len());
                    
                    Some(serde_json::json!({
                        "cheatDetection": cheat_detection,
                        "scanMode": true,
                        "screenshots": screenshots
                    }))
                } else {
                    None
                };
                
                // Add security changes to request if any
                let final_system_info = if !security_changes.is_empty() {
                    println!("[Iris Heartbeat] Security state changed: {:?}", security_changes);
                    let mut info = system_info.unwrap_or(serde_json::json!({}));
                    if let Some(obj) = info.as_object_mut() {
                        obj.insert("securityChanges".to_string(), serde_json::json!(security_changes));
                    }
                    Some(info)
                } else {
                    system_info
                };
                
                // Send heartbeat
                match api_client.send_heartbeat(
                    &token,
                    &hardware_id,
                    security_json,
                    final_system_info
                ).await {
                    Ok(response) => {
                        println!("[Iris Heartbeat] Data sent successfully");
                        
                        // Check if server enabled/disabled scan mode
                        if let Some(data) = response.data {
                            if let Some(scan) = data.get("scanModeEnabled") {
                                if let Some(enabled) = scan.as_bool() {
                                    SCAN_MODE_ENABLED.store(enabled, Ordering::SeqCst);
                                    println!("[Iris Heartbeat] Scan mode: {}", enabled);
                                }
                            }
                        }
                    }
                    Err(e) => {
                        println!("[Iris Heartbeat] Error: {}", e);
                    }
                }
            }
        }
        
        println!("[Iris] Heartbeat stopped");
    });
    
    Ok(())
}

/// Stop heartbeat
#[tauri::command]
pub async fn stop_heartbeat() -> Result<(), String> {
    HEARTBEAT_RUNNING.store(false, Ordering::SeqCst);
    Ok(())
}

/// Minimize window
#[tauri::command]
pub async fn window_minimize(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

/// Close window/app
#[tauri::command]
pub async fn window_close(app: AppHandle) -> Result<(), String> {
    stop_heartbeat().await?;
    app.exit(0);
    Ok(())
}

/// Open external URL
#[tauri::command]
pub async fn open_external(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("Failed to open URL: {}", e))
}

/// Check TPM availability
#[tauri::command]
pub async fn check_tpm() -> Result<TpmResult, String> {
    let tpm = hardware::check_tpm();
    Ok(TpmResult {
        available: tpm.present,
        version: if tpm.version.is_empty() { None } else { Some(tpm.version) },
        manufacturer: if tpm.manufacturer.is_empty() { None } else { Some(tpm.manufacturer) },
    })
}

/// Get full security status
#[tauri::command]
pub async fn get_security_status() -> Result<hardware::SecurityStatus, String> {
    Ok(hardware::get_full_security_status())
}
