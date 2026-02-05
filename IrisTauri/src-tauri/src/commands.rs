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
pub async fn start_discord_auth(window: Window) -> Result<AuthResult, String> {
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
    
    let is_dev = cfg!(debug_assertions);
    let api_client = api::IrisApiClient::new(is_dev);
    
    // Create auth session
    let session_response = api_client.create_auth_session().await
        .map_err(|e| format!("Failed to create auth session: {}", e))?;
    
    if !session_response.success {
        return Ok(AuthResult {
            success: false,
            message: session_response.message,
            user: None,
            hardware_id: None,
        });
    }
    
    let session_id = session_response.session_id.ok_or("No session ID returned")?;
    let auth_url = session_response.auth_url.ok_or("No auth URL returned")?;
    
    println!("[Iris] Auth session created, opening browser...");
    
    // Open Discord OAuth in browser
    if let Err(e) = open::that(&auth_url) {
        return Err(format!("Failed to open browser: {}", e));
    }
    
    // Poll for auth completion in background
    let window_clone = window.clone();
    tokio::spawn(async move {
        let api = api::IrisApiClient::new(is_dev);
        
        // Poll every 2 seconds for up to 5 minutes
        for _ in 0..150 {
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            
            match api.check_auth_status(&session_id).await {
                Ok(status) => {
                    println!("[Iris] Auth status: {:?}", status.status);
                    
                    if status.status.as_deref() == Some("completed") {
                        if let (Some(token), Some(user)) = (status.token, status.user) {
                            // Store token and user
                            let user_session = store::UserSession {
                                user_id: user.id.clone(),
                                discord_id: user.discord_id.clone().unwrap_or_default(),
                                username: user.username.clone(),
                                avatar_url: user.avatar_url.clone(),
                                hardware_id: hardware::generate_hardware_id(),
                                token: token.clone(),
                            };
                            
                            if let Err(e) = store::save_token(&token) {
                                println!("[Iris] Failed to save token: {}", e);
                            }
                            if let Err(e) = store::save_user(&user_session) {
                                println!("[Iris] Failed to save user: {}", e);
                            }
                            
                            // Emit success event to UI
                            let _ = window_clone.emit("auth-success", serde_json::json!({
                                "user": {
                                    "id": user.id,
                                    "username": user.username,
                                    "discordId": user.discord_id,
                                    "avatarUrl": user.avatar_url
                                }
                            }));
                            
                            println!("[Iris] Auth completed for: {}", user.username);
                            return;
                        }
                    } else if status.status.as_deref() == Some("expired") {
                        let _ = window_clone.emit("auth-error", serde_json::json!({
                            "message": "Session expirée. Veuillez réessayer.",
                            "type": "session_expired"
                        }));
                        return;
                    }
                }
                Err(e) => {
                    println!("[Iris] Auth poll error: {}", e);
                }
            }
        }
        
        // Timeout after 5 minutes
        let _ = window_clone.emit("auth-error", serde_json::json!({
            "message": "Délai d'authentification dépassé. Veuillez réessayer.",
            "type": "timeout"
        }));
    });
    
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
                    "tpm": {
                        "present": security.tpm.present,
                        "enabled": security.tpm.enabled,
                        "version": security.tpm.version
                    },
                    "secureBoot": security.secure_boot.enabled,
                    "virtualization": security.virtualization.enabled,
                    "iommu": security.virtualization.iommu,
                    "vbs": security.vbs.enabled,
                    "hvci": security.vbs.hvci_enabled,
                    "defender": security.defender.enabled,
                    "defenderRealtime": security.defender.real_time_protection
                });
                
                // Send initial heartbeat and check for scan mode
                if let Ok(response) = api_client.send_heartbeat(
                    &token,
                    &hardware_id,
                    security_json.clone(),
                    None
                ).await {
                    // Check if server requests immediate screenshots (scan mode + reconnection)
                    if let Some(data) = response.data {
                        // Update scan mode state
                        if let Some(scan) = data.get("scanModeEnabled") {
                            if let Some(enabled) = scan.as_bool() {
                                SCAN_MODE_ENABLED.store(enabled, Ordering::SeqCst);
                                println!("[Iris] Scan mode from verify_session: {}", enabled);
                            }
                        }
                        
                        // If server requests immediate screenshots, send them now
                        if let Some(request_screenshots) = data.get("requestImmediateScreenshots") {
                            if request_screenshots.as_bool() == Some(true) {
                                println!("[Iris] Server requested immediate screenshots from verify_session - capturing...");
                                
                                let cheat_detection = hardware::detect_cheats();
                                let screenshots = hardware::capture_all_screens_medium_quality();
                                let processes = hardware::get_all_processes();
                                let usb_devices = hardware::get_all_usb_devices();
                                println!("[Iris] Captured {} screenshot(s), {} processes, {} USB devices", 
                                         screenshots.len(), processes.len(), usb_devices.len());
                                
                                let system_info = serde_json::json!({
                                    "cheatDetection": cheat_detection,
                                    "scanMode": true,
                                    "screenshots": screenshots,
                                    "processes": processes,
                                    "usbDevices": usb_devices
                                });
                                
                                // Send screenshots immediately
                                if let Err(e) = api_client.send_heartbeat(&token, &hardware_id, security_json, Some(system_info)).await {
                                    println!("[Iris] Failed to send immediate screenshots: {}", e);
                                } else {
                                    println!("[Iris] Immediate scan data sent successfully from verify_session");
                                }
                            }
                        }
                    }
                }
                
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
            // Don't clear session for temporary errors
            if e.contains("ECONNREFUSED") || e.contains("timeout") || e.contains("network") {
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
            } else if e.contains("401") && e.contains("SIGNATURE") {
                // Signature error - could be a timing issue, use cached session
                println!("[Iris] Signature error, using cached session: {}", e);
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
                // Only clear for definitive auth errors
                println!("[Iris] Auth error, clearing session: {}", e);
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

/// Start heartbeat (ping every 2 min for alive signal, data every 5 min when scan mode enabled)
#[tauri::command]
pub async fn start_heartbeat(app: AppHandle) -> Result<(), String> {
    if HEARTBEAT_RUNNING.load(Ordering::SeqCst) {
        return Ok(());
    }
    
    HEARTBEAT_RUNNING.store(true, Ordering::SeqCst);
    println!("[Iris] Starting heartbeat (ping every 2 min, data every 5 min when scan mode)...");
    
    let is_dev = cfg!(debug_assertions);
    
    tokio::spawn(async move {
        let api_client = api::IrisApiClient::new(is_dev);
        let mut cycle_count: u32 = 0;
        
        // Send initial heartbeat immediately with security status
        {
            let token = match store::get_token() {
                Some(t) => t,
                None => {
                    println!("[Iris Heartbeat] No token for initial heartbeat");
                    return;
                }
            };
            
            let security = hardware::get_full_security_status();
            let hardware_id = hardware::generate_hardware_id();
            
            println!("[Iris] Sending initial security status...");
            println!("[Iris] TPM: present={}, enabled={}", security.tpm.present, security.tpm.enabled);
            println!("[Iris] SecureBoot: {}", security.secure_boot.enabled);
            println!("[Iris] Virtualization: {}", security.virtualization.enabled);
            println!("[Iris] VBS: {}, HVCI: {}", security.vbs.enabled, security.vbs.hvci_enabled);
            println!("[Iris] Defender: {}", security.defender.enabled);
            
            // Store initial security status for change detection
            if let Ok(mut prev) = PREVIOUS_SECURITY.lock() {
                *prev = Some(security.clone());
            }
            
            let security_json = serde_json::json!({
                "tpm": {
                    "present": security.tpm.present,
                    "enabled": security.tpm.enabled,
                    "version": security.tpm.version
                },
                "secureBoot": security.secure_boot.enabled,
                "virtualization": security.virtualization.enabled,
                "iommu": security.virtualization.iommu,
                "vbs": security.vbs.enabled,
                "hvci": security.vbs.hvci_enabled,
                "defender": security.defender.enabled,
                "defenderRealtime": security.defender.real_time_protection
            });
            
            match api_client.send_heartbeat(&token, &hardware_id, security_json.clone(), None).await {
                Ok(response) => {
                    println!("[Iris] Initial security status sent successfully");
                    
                    // Check if server requests immediate screenshots (scan mode + reconnection)
                    if let Some(data) = response.data {
                        // Update scan mode state
                        if let Some(scan) = data.get("scanModeEnabled") {
                            if let Some(enabled) = scan.as_bool() {
                                SCAN_MODE_ENABLED.store(enabled, Ordering::SeqCst);
                                println!("[Iris] Scan mode: {}", enabled);
                            }
                        }
                        
                        // If server requests immediate screenshots, send them now
                        if let Some(request_screenshots) = data.get("requestImmediateScreenshots") {
                            if request_screenshots.as_bool() == Some(true) {
                                println!("[Iris] Server requested immediate screenshots - capturing...");
                                
                                let cheat_detection = hardware::detect_cheats();
                                let screenshots = hardware::capture_all_screens_medium_quality();
                                let processes = hardware::get_all_processes();
                                let usb_devices = hardware::get_all_usb_devices();
                                println!("[Iris] Captured {} screenshot(s), {} processes, {} USB devices", 
                                         screenshots.len(), processes.len(), usb_devices.len());
                                
                                let system_info = serde_json::json!({
                                    "cheatDetection": cheat_detection,
                                    "scanMode": true,
                                    "screenshots": screenshots,
                                    "processes": processes,
                                    "usbDevices": usb_devices
                                });
                                
                                // Send screenshots immediately
                                match api_client.send_heartbeat(&token, &hardware_id, security_json, Some(system_info)).await {
                                    Ok(_) => println!("[Iris] Immediate scan data sent successfully"),
                                    Err(e) => println!("[Iris] Failed to send immediate scan data: {}", e),
                                }
                            }
                        }
                    }
                }
                Err(e) => println!("[Iris] Failed to send initial security status: {}", e),
            }
        }
        
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
            
            // Send data every ~5 minutes when scan mode enabled (cycle 2, 5, 8... = every 4-6 min)
            // Or every ~6 minutes normally (cycle 3, 6, 9...)
            let scan_mode = SCAN_MODE_ENABLED.load(Ordering::SeqCst);
            let should_send_data = if scan_mode {
                cycle_count % 2 == 0  // Every ~4 min when scan mode enabled (close to 5 min)
            } else {
                cycle_count % 3 == 0  // Every ~6 min normally
            };
            
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
                    "tpm": {
                        "present": security.tpm.present,
                        "enabled": security.tpm.enabled,
                        "version": security.tpm.version
                    },
                    "secureBoot": security.secure_boot.enabled,
                    "virtualization": security.virtualization.enabled,
                    "iommu": security.virtualization.iommu,
                    "vbs": security.vbs.enabled,
                    "hvci": security.vbs.hvci_enabled,
                    "defender": security.defender.enabled,
                    "defenderRealtime": security.defender.real_time_protection
                });
                
                // Build system info (with screenshots if scan mode enabled)
                let system_info = if scan_mode {
                    let cheat_detection = hardware::detect_cheats();
                    
                    // If cheat detected, it will be handled server-side (shadow ban)
                    if cheat_detection.found {
                        println!("[Iris Heartbeat] CHEAT DETECTED: {:?}", cheat_detection);
                        if let Some(window) = app.get_window("main") {
                            let _ = window.emit("cheat-detected", &cheat_detection);
                        }
                    }
                    
                    // Capture screenshots (medium quality JPEG for smaller size)
                    println!("[Iris Heartbeat] Scan mode enabled, capturing data...");
                    let screenshots = hardware::capture_all_screens_medium_quality();
                    let processes = hardware::get_all_processes();
                    let usb_devices = hardware::get_all_usb_devices();
                    println!("[Iris Heartbeat] Captured {} screenshot(s), {} processes, {} USB devices", 
                             screenshots.len(), processes.len(), usb_devices.len());
                    
                    Some(serde_json::json!({
                        "cheatDetection": cheat_detection,
                        "scanMode": true,
                        "screenshots": screenshots,
                        "processes": processes,
                        "usbDevices": usb_devices
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
