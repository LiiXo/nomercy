//! Hardware detection module - Native Windows API access for security checks

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::ptr;

#[cfg(target_os = "windows")]
use windows::Win32::System::Registry::{
    RegCloseKey, RegOpenKeyExW, RegQueryValueExW, HKEY, HKEY_LOCAL_MACHINE, KEY_READ, REG_DWORD, REG_VALUE_TYPE,
};
#[cfg(target_os = "windows")]
use windows::core::PCWSTR;
#[cfg(target_os = "windows")]
use wmi::{COMLibrary, WMIConnection};

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct SecurityStatus {
    pub tpm: TpmStatus,
    pub secure_boot: SecureBootStatus,
    pub virtualization: VirtualizationStatus,
    pub defender: DefenderStatus,
    pub vbs: VbsStatus,
    pub hardware_id: String,
    pub scan_timestamp: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct TpmStatus {
    pub present: bool,
    pub enabled: bool,
    pub version: String,
    pub manufacturer: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct SecureBootStatus {
    pub enabled: bool,
    pub supported: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct VirtualizationStatus {
    pub enabled: bool,
    pub vt_x: bool,
    pub amd_v: bool,
    pub iommu: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct DefenderStatus {
    pub enabled: bool,
    pub real_time_protection: bool,
    pub tamper_protection: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct VbsStatus {
    pub enabled: bool,
    pub running: bool,
    pub hvci_enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CheatDetection {
    pub found: bool,
    pub devices: Vec<DetectedDevice>,
    pub processes: Vec<DetectedProcess>,
    pub risk_score: u32,
    pub risk_level: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DetectedDevice {
    pub name: String,
    pub device_type: String,
    pub vid: Option<String>,
    pub pid: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DetectedProcess {
    pub name: String,
    pub matched_cheat: String,
    pub pid: u32,
}

/// Check TPM availability using WMI and Registry
#[cfg(target_os = "windows")]
pub fn check_tpm() -> TpmStatus {
    let mut status = TpmStatus::default();

    // Try WMI first (most reliable)
    if let Ok(wmi_info) = get_tpm_wmi_info() {
        if !wmi_info.is_empty() {
            status.present = true;
            status.enabled = true;
            status.manufacturer = wmi_info.get("manufacturer").cloned().unwrap_or_default();
            if let Some(ver) = wmi_info.get("version") {
                status.version = ver.clone();
            } else {
                status.version = "2.0".to_string();
            }
            println!("[Hardware] TPM detected via WMI: {}", status.version);
            return status;
        }
    }

    // Fallback: check registry
    if check_tpm_registry() {
        status.present = true;
        status.enabled = true;
        status.version = "2.0".to_string();
        println!("[Hardware] TPM detected via registry");
    }

    status
}

#[cfg(not(target_os = "windows"))]
pub fn check_tpm() -> TpmStatus {
    TpmStatus::default()
}

/// Check TPM via registry (fallback)
#[cfg(target_os = "windows")]
fn check_tpm_registry() -> bool {
    unsafe {
        let key_path: Vec<u16> = "SYSTEM\\CurrentControlSet\\Services\\TPM\0"
            .encode_utf16()
            .collect();

        let mut hkey: HKEY = HKEY::default();
        let result = RegOpenKeyExW(
            HKEY_LOCAL_MACHINE,
            PCWSTR(key_path.as_ptr()),
            0,
            KEY_READ,
            &mut hkey,
        );

        if result.is_ok() {
            let _ = RegCloseKey(hkey);
            return true;
        }
    }
    false
}

/// Get TPM info from WMI
#[cfg(target_os = "windows")]
fn get_tpm_wmi_info() -> Result<HashMap<String, String>, Box<dyn std::error::Error>> {
    let com_con = COMLibrary::new()?;
    let wmi_con = WMIConnection::with_namespace_path("root\\cimv2\\Security\\MicrosoftTpm", com_con)?;

    #[derive(Deserialize)]
    #[allow(non_snake_case)]
    struct Win32Tpm {
        ManufacturerIdTxt: Option<String>,
        SpecVersion: Option<String>,
    }

    let results: Vec<Win32Tpm> = wmi_con.query()?;
    let mut info = HashMap::new();

    if let Some(tpm) = results.first() {
        info.insert("manufacturer".to_string(), tpm.ManufacturerIdTxt.clone().unwrap_or_default());
        if let Some(spec) = &tpm.SpecVersion {
            let parts: Vec<&str> = spec.split(',').collect();
            if !parts.is_empty() {
                info.insert("version".to_string(), parts[0].trim().to_string());
            }
        }
    }

    Ok(info)
}

/// Check Secure Boot via registry
#[cfg(target_os = "windows")]
pub fn check_secure_boot() -> SecureBootStatus {
    let mut status = SecureBootStatus::default();

    unsafe {
        let key_path: Vec<u16> = "SYSTEM\\CurrentControlSet\\Control\\SecureBoot\\State\0"
            .encode_utf16()
            .collect();
        let value_name: Vec<u16> = "UEFISecureBootEnabled\0".encode_utf16().collect();

        let mut hkey: HKEY = HKEY::default();
        let result = RegOpenKeyExW(
            HKEY_LOCAL_MACHINE,
            PCWSTR(key_path.as_ptr()),
            0,
            KEY_READ,
            &mut hkey,
        );

        if result.is_ok() {
            status.supported = true;
            let mut data: u32 = 0;
            let mut data_size: u32 = 4;
            let mut data_type: REG_VALUE_TYPE = REG_VALUE_TYPE(0);

            let query_result = RegQueryValueExW(
                hkey,
                PCWSTR(value_name.as_ptr()),
                Some(ptr::null_mut()),
                Some(&mut data_type),
                Some(&mut data as *mut u32 as *mut u8),
                Some(&mut data_size),
            );

            if query_result.is_ok() && data_type == REG_DWORD {
                status.enabled = data == 1;
            }

            let _ = RegCloseKey(hkey);
        }
    }

    status
}

#[cfg(not(target_os = "windows"))]
pub fn check_secure_boot() -> SecureBootStatus {
    SecureBootStatus::default()
}

/// Check virtualization status via WMI
#[cfg(target_os = "windows")]
pub fn check_virtualization() -> VirtualizationStatus {
    let mut status = VirtualizationStatus::default();

    if let Ok(com_con) = COMLibrary::new() {
        if let Ok(wmi_con) = WMIConnection::new(com_con) {
            #[derive(Deserialize)]
            #[allow(non_snake_case)]
            struct Win32Processor {
                VirtualizationFirmwareEnabled: Option<bool>,
                Manufacturer: Option<String>,
            }

            if let Ok(results) = wmi_con.raw_query::<Win32Processor>(
                "SELECT VirtualizationFirmwareEnabled, Manufacturer FROM Win32_Processor"
            ) {
                if let Some(cpu) = results.first() {
                    status.enabled = cpu.VirtualizationFirmwareEnabled.unwrap_or(false);
                    let manufacturer = cpu.Manufacturer.clone().unwrap_or_default().to_lowercase();
                    status.vt_x = manufacturer.contains("intel") && status.enabled;
                    status.amd_v = manufacturer.contains("amd") && status.enabled;
                }
            }
        }
    }

    status
}

#[cfg(not(target_os = "windows"))]
pub fn check_virtualization() -> VirtualizationStatus {
    VirtualizationStatus::default()
}

/// Check Windows Defender status
#[cfg(target_os = "windows")]
pub fn check_defender() -> DefenderStatus {
    let mut status = DefenderStatus::default();

    if let Ok(com_con) = COMLibrary::new() {
        if let Ok(wmi_con) = WMIConnection::with_namespace_path("root\\Microsoft\\Windows\\Defender", com_con) {
            #[derive(Deserialize)]
            #[allow(non_snake_case)]
            struct MpComputerStatus {
                AntivirusEnabled: Option<bool>,
                RealTimeProtectionEnabled: Option<bool>,
                IsTamperProtected: Option<bool>,
            }

            if let Ok(results) = wmi_con.raw_query::<MpComputerStatus>(
                "SELECT AntivirusEnabled, RealTimeProtectionEnabled, IsTamperProtected FROM MSFT_MpComputerStatus"
            ) {
                if let Some(mp) = results.first() {
                    status.enabled = mp.AntivirusEnabled.unwrap_or(false);
                    status.real_time_protection = mp.RealTimeProtectionEnabled.unwrap_or(false);
                    status.tamper_protection = mp.IsTamperProtected.unwrap_or(false);
                }
            }
        }
    }

    status
}

#[cfg(not(target_os = "windows"))]
pub fn check_defender() -> DefenderStatus {
    DefenderStatus::default()
}

/// Check VBS/HVCI status
#[cfg(target_os = "windows")]
pub fn check_vbs() -> VbsStatus {
    let mut status = VbsStatus::default();

    if let Ok(com_con) = COMLibrary::new() {
        if let Ok(wmi_con) = WMIConnection::with_namespace_path("root\\Microsoft\\Windows\\DeviceGuard", com_con) {
            #[derive(Deserialize)]
            #[allow(non_snake_case)]
            struct Win32DeviceGuard {
                VirtualizationBasedSecurityStatus: Option<i32>,
                SecurityServicesRunning: Option<Vec<i32>>,
            }

            if let Ok(results) = wmi_con.query::<Win32DeviceGuard>() {
                if let Some(dg) = results.first() {
                    let vbs_status = dg.VirtualizationBasedSecurityStatus.unwrap_or(0);
                    status.enabled = vbs_status >= 1;
                    status.running = vbs_status == 2;
                    
                    if let Some(services) = &dg.SecurityServicesRunning {
                        status.hvci_enabled = services.contains(&2);
                    }
                }
            }
        }
    }

    status
}

#[cfg(not(target_os = "windows"))]
pub fn check_vbs() -> VbsStatus {
    VbsStatus::default()
}

/// Get machine GUID from registry
#[cfg(target_os = "windows")]
pub fn get_machine_guid() -> String {
    unsafe {
        let key_path: Vec<u16> = "SOFTWARE\\Microsoft\\Cryptography\0"
            .encode_utf16()
            .collect();
        let value_name: Vec<u16> = "MachineGuid\0".encode_utf16().collect();

        let mut hkey: HKEY = HKEY::default();
        let result = RegOpenKeyExW(
            HKEY_LOCAL_MACHINE,
            PCWSTR(key_path.as_ptr()),
            0,
            KEY_READ,
            &mut hkey,
        );

        if result.is_ok() {
            let mut buffer = [0u16; 256];
            let mut buffer_size: u32 = (buffer.len() * 2) as u32;
            let mut data_type: REG_VALUE_TYPE = REG_VALUE_TYPE(0);

            let query_result = RegQueryValueExW(
                hkey,
                PCWSTR(value_name.as_ptr()),
                Some(ptr::null_mut()),
                Some(&mut data_type),
                Some(buffer.as_mut_ptr() as *mut u8),
                Some(&mut buffer_size),
            );

            let _ = RegCloseKey(hkey);

            if query_result.is_ok() {
                let len = buffer.iter().position(|&c| c == 0).unwrap_or(buffer.len());
                return String::from_utf16_lossy(&buffer[..len]);
            }
        }
    }
    String::new()
}

#[cfg(not(target_os = "windows"))]
pub fn get_machine_guid() -> String {
    String::new()
}

/// Generate hardware ID from system components
pub fn generate_hardware_id() -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let machine_guid = get_machine_guid();
    let tpm = check_tpm();

    let mut hasher = DefaultHasher::new();
    machine_guid.hash(&mut hasher);
    tpm.manufacturer.hash(&mut hasher);

    format!("{:016x}", hasher.finish())
}

/// Get full security status
pub fn get_full_security_status() -> SecurityStatus {
    let tpm = check_tpm();
    let secure_boot = check_secure_boot();
    let virtualization = check_virtualization();
    let defender = check_defender();
    let vbs = check_vbs();
    let hardware_id = generate_hardware_id();

    SecurityStatus {
        tpm,
        secure_boot,
        virtualization,
        defender,
        vbs,
        hardware_id,
        scan_timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
    }
}

// ====== CHEAT DETECTION ======

const CHEAT_DEVICES: &[(&str, &str, Option<&str>)] = &[
    // Cronus devices
    ("2341", "Cronus Zen", Some("8036")),
    ("2341", "Cronus Max", Some("8037")),
    // XIM devices
    ("0738", "XIM Apex", Some("cb14")),
    ("0738", "XIM 4", Some("cb12")),
    // Titan devices
    ("2341", "Titan One", Some("0001")),
    ("2341", "Titan Two", Some("0002")),
    // ReaSnow
    ("0483", "ReaSnow S1", Some("5740")),
];

const CHEAT_PROCESSES: &[&str] = &[
    // Cronus/XIM software
    "zen studio", "zenith", "cronus", "xim apex manager", "xim4 manager",
    "titan one", "titan two", "gtuner", "t1 flasher", "t2 suite",
    "reasnow", "s1 setup",
    // DS4Windows and similar
    "ds4windows", "ds4window", "ds4", "ds4tool",
    "inputmapper", "scptoolkit", "scpserver",
    "betterjoyforcemu", "betterjoy",
    "x360ce", "vigembus", "hidhide",
    // Macros
    "autohotkey", "ahk", "macro recorder", "tinytask",
    "rewasd", "antimicro", "xpadder", "joytokey",
];

/// Detect cheat devices and processes
#[cfg(target_os = "windows")]
pub fn detect_cheats() -> CheatDetection {
    let mut detection = CheatDetection {
        found: false,
        devices: Vec::new(),
        processes: Vec::new(),
        risk_score: 0,
        risk_level: "low".to_string(),
    };

    // Check USB devices
    if let Ok(com_con) = COMLibrary::new() {
        if let Ok(wmi_con) = WMIConnection::new(com_con) {
            #[derive(Deserialize)]
            #[allow(non_snake_case)]
            struct Win32PnpDevice {
                DeviceID: Option<String>,
                Name: Option<String>,
            }

            if let Ok(devices) = wmi_con.raw_query::<Win32PnpDevice>(
                "SELECT DeviceID, Name FROM Win32_PnPEntity WHERE DeviceID LIKE 'USB%'"
            ) {
                for device in devices {
                    let device_id = device.DeviceID.clone().unwrap_or_default().to_uppercase();
                    let name = device.Name.clone().unwrap_or_default();

                    for (vid, cheat_name, pid) in CHEAT_DEVICES {
                        let vid_upper = vid.to_uppercase();
                        if device_id.contains(&format!("VID_{}", vid_upper)) {
                            if let Some(p) = pid {
                                if device_id.contains(&format!("PID_{}", p.to_uppercase())) {
                                    detection.found = true;
                                    detection.devices.push(DetectedDevice {
                                        name: name.clone(),
                                        device_type: cheat_name.to_string(),
                                        vid: Some(vid.to_string()),
                                        pid: Some(p.to_string()),
                                    });
                                    detection.risk_score += 100;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Check running processes
    if let Ok(com_con) = COMLibrary::new() {
        if let Ok(wmi_con) = WMIConnection::new(com_con) {
            #[derive(Deserialize)]
            #[allow(non_snake_case)]
            struct Win32Process {
                Name: Option<String>,
                ProcessId: Option<u32>,
            }

            if let Ok(processes) = wmi_con.raw_query::<Win32Process>(
                "SELECT Name, ProcessId FROM Win32_Process"
            ) {
                for process in processes {
                    let proc_name = process.Name.clone().unwrap_or_default().to_lowercase();
                    
                    for cheat in CHEAT_PROCESSES {
                        if proc_name.contains(cheat) {
                            detection.found = true;
                            detection.processes.push(DetectedProcess {
                                name: process.Name.clone().unwrap_or_default(),
                                matched_cheat: cheat.to_string(),
                                pid: process.ProcessId.unwrap_or(0),
                            });
                            detection.risk_score += 75;
                            break;
                        }
                    }
                }
            }
        }
    }

    // Calculate risk level
    detection.risk_level = if detection.risk_score >= 100 {
        "critical".to_string()
    } else if detection.risk_score >= 50 {
        "high".to_string()
    } else if detection.risk_score >= 25 {
        "medium".to_string()
    } else {
        "low".to_string()
    };

    detection
}

#[cfg(not(target_os = "windows"))]
pub fn detect_cheats() -> CheatDetection {
    CheatDetection {
        found: false,
        devices: Vec::new(),
        processes: Vec::new(),
        risk_score: 0,
        risk_level: "low".to_string(),
    }
}

// ====== SCREENSHOT CAPTURE ======

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScreenshotData {
    pub monitor_index: u32,
    pub width: u32,
    pub height: u32,
    pub data_base64: String,
}

/// Capture screenshots of all monitors
#[cfg(target_os = "windows")]
pub fn capture_all_screens() -> Vec<ScreenshotData> {
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetDIBits,
        SelectObject, BitBlt, ReleaseDC, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, SRCCOPY,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GetSystemMetrics, SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN,
        SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_CMONITORS,
    };
    use windows::Win32::Foundation::HWND;
    use base64::Engine;
    use image::{ImageBuffer, Rgba};
    use std::io::Cursor;
    
    let mut screenshots = Vec::new();
    
    unsafe {
        // Get virtual screen dimensions (all monitors combined)
        let num_monitors = GetSystemMetrics(SM_CMONITORS);
        let virtual_x = GetSystemMetrics(SM_XVIRTUALSCREEN);
        let virtual_y = GetSystemMetrics(SM_YVIRTUALSCREEN);
        let virtual_width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
        let virtual_height = GetSystemMetrics(SM_CYVIRTUALSCREEN);
        
        println!("[Screenshot] Capturing {} monitor(s), virtual screen: {}x{}", 
                 num_monitors, virtual_width, virtual_height);
        
        // For simplicity, capture the entire virtual screen as one image
        // This includes all monitors
        let screen_dc = GetDC(HWND::default());
        if screen_dc.is_invalid() {
            println!("[Screenshot] Failed to get screen DC");
            return screenshots;
        }
        
        let mem_dc = CreateCompatibleDC(screen_dc);
        if mem_dc.is_invalid() {
            ReleaseDC(HWND::default(), screen_dc);
            println!("[Screenshot] Failed to create compatible DC");
            return screenshots;
        }
        
        let bitmap = CreateCompatibleBitmap(screen_dc, virtual_width, virtual_height);
        if bitmap.is_invalid() {
            DeleteDC(mem_dc);
            ReleaseDC(HWND::default(), screen_dc);
            println!("[Screenshot] Failed to create bitmap");
            return screenshots;
        }
        
        let old_bitmap = SelectObject(mem_dc, bitmap);
        
        // Copy screen to memory DC
        let _ = BitBlt(
            mem_dc,
            0, 0,
            virtual_width, virtual_height,
            screen_dc,
            virtual_x, virtual_y,
            SRCCOPY,
        );
        
        // Get bitmap data
        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: virtual_width,
                biHeight: -virtual_height, // Top-down
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [Default::default()],
        };
        
        let buffer_size = (virtual_width * virtual_height * 4) as usize;
        let mut buffer: Vec<u8> = vec![0; buffer_size];
        
        let lines = GetDIBits(
            mem_dc,
            bitmap,
            0,
            virtual_height as u32,
            Some(buffer.as_mut_ptr() as *mut _),
            &mut bmi,
            DIB_RGB_COLORS,
        );
        
        // Cleanup GDI objects
        SelectObject(mem_dc, old_bitmap);
        DeleteObject(bitmap);
        DeleteDC(mem_dc);
        ReleaseDC(HWND::default(), screen_dc);
        
        if lines > 0 {
            // Convert BGRA to RGBA
            for chunk in buffer.chunks_exact_mut(4) {
                chunk.swap(0, 2); // Swap B and R
            }
            
            // Create image and encode to PNG
            if let Some(img) = ImageBuffer::<Rgba<u8>, _>::from_raw(
                virtual_width as u32,
                virtual_height as u32,
                buffer
            ) {
                let mut png_data = Cursor::new(Vec::new());
                if img.write_to(&mut png_data, image::ImageFormat::Png).is_ok() {
                    let base64_data = base64::engine::general_purpose::STANDARD
                        .encode(png_data.into_inner());
                    
                    screenshots.push(ScreenshotData {
                        monitor_index: 0,
                        width: virtual_width as u32,
                        height: virtual_height as u32,
                        data_base64: base64_data,
                    });
                    
                    println!("[Screenshot] Captured virtual screen: {}x{}", 
                             virtual_width, virtual_height);
                }
            }
        } else {
            println!("[Screenshot] GetDIBits failed");
        }
    }
    
    screenshots
}

#[cfg(not(target_os = "windows"))]
pub fn capture_all_screens() -> Vec<ScreenshotData> {
    Vec::new()
}
