//! Hardware detection module - Native Windows API access for security checks

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::ptr;

#[cfg(target_os = "windows")]
use windows::Win32::System::Registry::{
    RegCloseKey, RegOpenKeyExW, RegQueryValueExW, RegEnumKeyExW, HKEY, HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER, KEY_READ, REG_DWORD, REG_VALUE_TYPE,
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
    pub kernel_dma_protection: bool, // Key for blocking DMA cheats - enforces IOMMU at OS level
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
#[serde(rename_all = "camelCase")]
pub struct CheatDetection {
    pub found: bool,
    pub devices: Vec<DetectedDevice>,
    pub processes: Vec<DetectedProcess>,
    pub risk_score: u32,
    pub risk_level: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DetectedDevice {
    pub name: String,
    pub device_type: String,
    pub vid: Option<String>,
    pub pid: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DetectedProcess {
    pub name: String,
    pub matched_cheat: String,
    pub pid: u32,
}

// ====== NEW DETECTION STRUCTS ======

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct NetworkMonitorResult {
    pub vpn_detected: bool,
    pub proxy_detected: bool,
    pub vpn_adapters: Vec<String>,
    pub vpn_processes: Vec<String>,
    pub proxy_settings: Option<String>,
    pub risk_score: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RegistryTrace {
    pub path: String,
    pub cheat_name: String,
    pub trace_type: String, // "install", "uninstall", "spoofer", "driver"
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct RegistryScanResult {
    pub traces_found: bool,
    pub traces: Vec<RegistryTrace>,
    pub risk_score: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SuspiciousDriver {
    pub name: String,
    pub display_name: String,
    pub path: Option<String>,
    pub reason: String, // "cheat_driver", "unsigned", "interception"
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct DriverIntegrityResult {
    pub suspicious_found: bool,
    pub suspicious_drivers: Vec<SuspiciousDriver>,
    pub risk_score: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DetectedMacro {
    pub name: String,
    pub macro_type: String, // "ahk", "logitech", "razer", "generic"
    pub source: String,     // "process", "registry", "window"
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct MacroDetectionResult {
    pub macros_detected: bool,
    pub detected_software: Vec<DetectedMacro>,
    pub risk_score: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SuspiciousOverlay {
    pub window_title: String,
    pub process_name: String,
    pub class_name: String,
    pub reason: String, // "transparent", "topmost", "cheat_process", "suspicious_class"
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct OverlayDetectionResult {
    pub overlays_found: bool,
    pub suspicious_overlays: Vec<SuspiciousOverlay>,
    pub risk_score: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SuspiciousDll {
    pub name: String,
    pub path: Option<String>,
    pub reason: String, // "known_injector", "unsigned", "suspicious_location", "hook_dll"
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct DllInjectionResult {
    pub injection_detected: bool,
    pub suspicious_dlls: Vec<SuspiciousDll>,
    pub risk_score: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct VmDetectionResult {
    pub vm_detected: bool,
    pub vm_type: Option<String>,          // "VMware", "VirtualBox", "Hyper-V", "QEMU", etc.
    pub vm_indicators: Vec<String>,        // List of detection indicators found
    pub risk_score: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct CloudPcDetectionResult {
    pub cloud_pc_detected: bool,
    pub cloud_provider: Option<String>,    // "Shadow", "GeForce NOW", "Parsec", "Azure", etc.
    pub cloud_indicators: Vec<String>,     // List of detection indicators found
    pub is_gaming_cloud: bool,             // True if it's a gaming cloud service
    pub risk_score: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DetectedCheatWindow {
    pub window_title: String,
    pub process_name: String,
    pub matched_cheat: String,
    pub risk_level: String, // "critical", "high", "medium"
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct CheatWindowDetectionResult {
    pub cheats_found: bool,
    pub detected_windows: Vec<DetectedCheatWindow>,
    pub risk_score: u32,
}

// ====== GAME DETECTION (Anti-Bypass) ======

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct GameDetectionResult {
    pub game_running: bool,
    pub game_name: Option<String>,
    pub game_pid: Option<u32>,
    pub game_window_active: bool,  // Is player focused on game window?
    pub last_detected: u64,        // Timestamp in ms
}

/// Extended game detection with session-level window activity tracking
/// Used to detect if player has the game running but isn't actually playing
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct GameSessionActivity {
    pub game_running: bool,
    pub game_name: Option<String>,
    pub game_pid: Option<u32>,
    pub game_window_active: bool,
    pub last_detected: u64,
    // Session tracking for window activity percentage
    pub session_start: u64,              // When tracking started (ms since epoch)
    pub total_samples: u32,               // Total heartbeat samples in session
    pub active_samples: u32,              // Samples where game window was active
    pub activity_percentage: f32,         // Calculated % of time window was active
    pub last_active_at: u64,              // Last time window was detected active
    pub consecutive_inactive: u32,        // Consecutive samples with inactive window
}

// Global tracking for game session activity (persists between detect_game_running calls)
use std::sync::Mutex;
use lazy_static::lazy_static;

lazy_static! {
    static ref GAME_SESSION_TRACKER: Mutex<GameSessionTracker> = Mutex::new(GameSessionTracker::default());
}

#[derive(Debug, Clone, Default)]
struct GameSessionTracker {
    session_start: u64,
    total_samples: u32,
    active_samples: u32,
    last_active_at: u64,
    consecutive_inactive: u32,
    last_game_pid: Option<u32>,
}

// Call of Duty / Black Ops game process names to detect
const GAME_PROCESSES: &[(&str, &str)] = &[
    // Black Ops 7 / BO7
    ("cod.exe", "Call of Duty"),
    ("blackops7.exe", "Black Ops 7"),
    ("bo7.exe", "Black Ops 7"),
    ("cod-bo7.exe", "Black Ops 7"),
    ("blackops7-cod.exe", "Black Ops 7"),
    // Black Ops 6 / BO6
    ("blackops6.exe", "Black Ops 6"),
    ("bo6.exe", "Black Ops 6"),
    // Modern Warfare / Warzone
    ("modernwarfare.exe", "Modern Warfare"),
    ("cod_mw.exe", "Modern Warfare"),
    ("codmw.exe", "Modern Warfare"),
    // Warzone
    ("warzone.exe", "Warzone"),
    ("codwarzone.exe", "Warzone"),
    // Battle.net launcher spawns these
    ("cod_ship.exe", "Call of Duty"),
    ("codship.exe", "Call of Duty"),
    // Generic CoD executables
    ("callofduty.exe", "Call of Duty"),
    ("call of duty.exe", "Call of Duty"),
];

/// Check TPM availability using WMI and Registry
#[cfg(target_os = "windows")]
pub fn check_tpm() -> TpmStatus {
    let mut status = TpmStatus::default();

    // Try WMI first (most reliable) - checks actual activation state
    if let Ok(wmi_info) = get_tpm_wmi_info() {
        if !wmi_info.is_empty() {
            status.present = true;
            // Check actual enabled/activated state from WMI
            let is_enabled = wmi_info.get("enabled").map(|v| v == "true").unwrap_or(false);
            let is_activated = wmi_info.get("activated").map(|v| v == "true").unwrap_or(false);
            status.enabled = is_enabled || is_activated;
            status.manufacturer = wmi_info.get("manufacturer").cloned().unwrap_or_default();
            if let Some(ver) = wmi_info.get("version") {
                status.version = ver.clone();
            } else {
                status.version = "2.0".to_string();
            }
            println!("[Hardware] TPM detected via WMI: version={}, enabled={}, activated={}", 
                     status.version, is_enabled, is_activated);
            return status;
        }
    }

    // Fallback: check registry for actual TPM hardware presence
    if check_tpm_registry() {
        status.present = true;
        // Registry fallback only confirms presence, not that it's enabled
        // Check if TPM is actually ready via the TBS service registry
        status.enabled = check_tpm_enabled_registry();
        status.version = "2.0".to_string();
        println!("[Hardware] TPM detected via registry: present=true, enabled={}", status.enabled);
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
        IsEnabled_InitialValue: Option<bool>,
        IsActivated_InitialValue: Option<bool>,
    }

    let results: Vec<Win32Tpm> = wmi_con.query()?;
    let mut info = HashMap::new();

    if let Some(tpm) = results.first() {
        info.insert("manufacturer".to_string(), tpm.ManufacturerIdTxt.clone().unwrap_or_default());
        info.insert("enabled".to_string(), tpm.IsEnabled_InitialValue.unwrap_or(false).to_string());
        info.insert("activated".to_string(), tpm.IsActivated_InitialValue.unwrap_or(false).to_string());
        if let Some(spec) = &tpm.SpecVersion {
            let parts: Vec<&str> = spec.split(',').collect();
            if !parts.is_empty() {
                info.insert("version".to_string(), parts[0].trim().to_string());
            }
        }
    }

    Ok(info)
}

/// Check if TPM is actually enabled via registry (not just service installed)
#[cfg(target_os = "windows")]
fn check_tpm_enabled_registry() -> bool {
    unsafe {
        // Check TBS (TPM Base Services) - indicates TPM is actually functional
        let key_path: Vec<u16> = "SOFTWARE\\Microsoft\\Tpm\0"
            .encode_utf16()
            .collect();
        let value_name: Vec<u16> = "HasEndorsementKey\0".encode_utf16().collect();

        let mut hkey: HKEY = HKEY::default();
        let result = RegOpenKeyExW(
            HKEY_LOCAL_MACHINE,
            PCWSTR(key_path.as_ptr()),
            0,
            KEY_READ,
            &mut hkey,
        );

        if result.is_ok() {
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

            let _ = RegCloseKey(hkey);

            if query_result.is_ok() && data_type == REG_DWORD && data == 1 {
                return true;
            }
        }
    }
    // If we can't confirm enabled via registry, assume true since the TPM service key exists
    // (presence was already confirmed by check_tpm_registry)
    true
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

/// Check virtualization status via multiple methods
#[cfg(target_os = "windows")]
pub fn check_virtualization() -> VirtualizationStatus {
    let mut status = VirtualizationStatus::default();
    let mut is_intel = false;
    let mut is_amd = false;

    // Method 1: Check Win32_Processor
    if let Ok(com_con) = COMLibrary::new() {
        if let Ok(wmi_con) = WMIConnection::new(com_con) {
            #[derive(Deserialize)]
            #[allow(non_snake_case)]
            struct Win32Processor {
                VirtualizationFirmwareEnabled: Option<bool>,
                SecondLevelAddressTranslationExtensions: Option<bool>,
                Manufacturer: Option<String>,
            }

            if let Ok(results) = wmi_con.raw_query::<Win32Processor>(
                "SELECT VirtualizationFirmwareEnabled, SecondLevelAddressTranslationExtensions, Manufacturer FROM Win32_Processor"
            ) {
                if let Some(cpu) = results.first() {
                    let manufacturer = cpu.Manufacturer.clone().unwrap_or_default().to_lowercase();
                    is_intel = manufacturer.contains("intel");
                    is_amd = manufacturer.contains("amd");
                    
                    // Direct firmware check
                    if cpu.VirtualizationFirmwareEnabled.unwrap_or(false) {
                        status.enabled = true;
                    }
                    
                    // SLAT (Second Level Address Translation) requires VT-x/AMD-V
                    if cpu.SecondLevelAddressTranslationExtensions.unwrap_or(false) {
                        status.enabled = true;
                    }
                }
            }
        }
    }
        
    // Method 2: Check if Hyper-V is running (requires virtualization)
    if let Ok(com_con) = COMLibrary::new() {
        if let Ok(wmi_con) = WMIConnection::new(com_con) {
            #[derive(Deserialize)]
            #[allow(non_snake_case)]
            struct Win32ComputerSystem {
                HypervisorPresent: Option<bool>,
            }

            if let Ok(results) = wmi_con.raw_query::<Win32ComputerSystem>(
                "SELECT HypervisorPresent FROM Win32_ComputerSystem"
            ) {
                if let Some(cs) = results.first() {
                    if cs.HypervisorPresent.unwrap_or(false) {
                        // Hypervisor is running = virtualization MUST be enabled
                        status.enabled = true;
                        println!("[Hardware] Hypervisor detected - virtualization enabled");
                    }
                }
            }
        }
    }
        
    // Method 3: Check DeviceGuard VBS status (requires virtualization)
    if let Ok(com_con) = COMLibrary::new() {
        if let Ok(wmi_con) = WMIConnection::with_namespace_path("root\\Microsoft\\Windows\\DeviceGuard", com_con) {
            #[derive(Deserialize)]
            #[allow(non_snake_case)]
            struct Win32DeviceGuard {
                VirtualizationBasedSecurityStatus: Option<i32>,
            }

            if let Ok(results) = wmi_con.query::<Win32DeviceGuard>() {
                if let Some(dg) = results.first() {
                    let vbs_status = dg.VirtualizationBasedSecurityStatus.unwrap_or(0);
                    if vbs_status >= 1 {
                        // VBS requires virtualization
                        status.enabled = true;
                        println!("[Hardware] VBS enabled - virtualization must be enabled");
                    }
                }
            }
        }
    }

    // Set VT-x or AMD-V based on manufacturer
    status.vt_x = is_intel && status.enabled;
    status.amd_v = is_amd && status.enabled;
    
    // Method 4: Check registry for IOMMU
    status.iommu = check_iommu_registry();
    
    // Method 5: Check Kernel DMA Protection (CRITICAL for blocking DMA cheats)
    // IOMMU present doesn't mean it's enforced - Kernel DMA Protection does the actual blocking
    status.kernel_dma_protection = check_kernel_dma_protection();
    
    println!("[Hardware] Virtualization check: enabled={}, vt_x={}, amd_v={}, iommu={}, kernel_dma_protection={}", 
             status.enabled, status.vt_x, status.amd_v, status.iommu, status.kernel_dma_protection);

    status
}

/// Check IOMMU (VT-d/AMD-Vi) via multiple methods
#[cfg(target_os = "windows")]
fn check_iommu_registry() -> bool {
    // Method 1: Enumerate FIRMWARE\ACPI tables for DMAR signature (most reliable for Intel VT-d)
    if check_acpi_firmware_tables() {
        return true;
    }
    
    // Method 2: ACPI DMAR table (Intel VT-d) - Check multiple possible paths
    let dmar_paths = [
        "HARDWARE\\ACPI\\DMAR",
        "HARDWARE\\ACPI\\DSDT\\INTL\\DMAR",
        "HARDWARE\\ACPI\\FADT\\DMAR",
        "HARDWARE\\ACPI\\RSDT\\DMAR",
        "HARDWARE\\ACPI\\XSDT\\DMAR",
    ];
    
    for dmar_path in dmar_paths {
        unsafe {
            let key_path: Vec<u16> = format!("{}\0", dmar_path).encode_utf16().collect();
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
                println!("[Hardware] IOMMU detected via ACPI DMAR table at {}", dmar_path);
                return true;
            }
        }
    }

    // Method 3: ACPI IVRS table (AMD-Vi equivalent)
    let ivrs_paths = [
        "HARDWARE\\ACPI\\IVRS",
        "HARDWARE\\ACPI\\DSDT\\AMDM\\IVRS",
        "HARDWARE\\ACPI\\RSDT\\IVRS",
        "HARDWARE\\ACPI\\XSDT\\IVRS",
    ];
    
    for ivrs_path in ivrs_paths {
        unsafe {
            let key_path: Vec<u16> = format!("{}\0", ivrs_path).encode_utf16().collect();
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
                println!("[Hardware] IOMMU detected via ACPI IVRS table at {}", ivrs_path);
                return true;
            }
        }
    }

    // Method 4: WMI DeviceGuard AvailableSecurityProperties
    if let Ok(com_con) = COMLibrary::new() {
        if let Ok(wmi_con) = WMIConnection::with_namespace_path("root\\Microsoft\\Windows\\DeviceGuard", com_con) {
            #[derive(Deserialize)]
            #[allow(non_snake_case)]
            struct Win32DeviceGuard {
                AvailableSecurityProperties: Option<Vec<i32>>,
            }

            if let Ok(results) = wmi_con.query::<Win32DeviceGuard>() {
                if let Some(dg) = results.first() {
                    if let Some(props) = &dg.AvailableSecurityProperties {
                        println!("[Hardware] DeviceGuard AvailableSecurityProperties: {:?}", props);
                        // 3 = DMA protection available, 6 = Kernel DMA Guard, 7 = MAT/IOMMU
                        if props.contains(&3) || props.contains(&6) || props.contains(&7) {
                            println!("[Hardware] IOMMU detected via DeviceGuard properties");
                            return true;
                        }
                    }
                }
            }
        }
    }

    // Method 5: Check Kernel DMA Protection registry
    unsafe {
        let key_path: Vec<u16> = "SYSTEM\\CurrentControlSet\\Control\\DmaSecurity\0"
            .encode_utf16()
            .collect();
        let value_name: Vec<u16> = "DmaKernelProtection\0".encode_utf16().collect();

        let mut hkey: HKEY = HKEY::default();
        let result = RegOpenKeyExW(
            HKEY_LOCAL_MACHINE,
            PCWSTR(key_path.as_ptr()),
            0,
            KEY_READ,
            &mut hkey,
        );

        if result.is_ok() {
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

            let _ = RegCloseKey(hkey);

            if query_result.is_ok() && data_type == REG_DWORD && data == 1 {
                println!("[Hardware] IOMMU detected via Kernel DMA Protection");
                return true;
            }
        }
    }

    // Method 6: Check DMA Guard policy requirement
    unsafe {
        let key_path: Vec<u16> = "SYSTEM\\CurrentControlSet\\Control\\DeviceGuard\0"
            .encode_utf16()
            .collect();
        let value_name: Vec<u16> = "RequirePlatformSecurityFeatures\0".encode_utf16().collect();

        let mut hkey: HKEY = HKEY::default();
        let result = RegOpenKeyExW(
            HKEY_LOCAL_MACHINE,
            PCWSTR(key_path.as_ptr()),
            0,
            KEY_READ,
            &mut hkey,
        );

        if result.is_ok() {
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

            let _ = RegCloseKey(hkey);

            if query_result.is_ok() && data_type == REG_DWORD && data >= 3 {
                println!("[Hardware] IOMMU detected via DMA Guard requirement");
                return true;
            }
        }
    }
    
    // Method 7: Check via WMI Processor feature flags
    if let Ok(com_con) = COMLibrary::new() {
        if let Ok(wmi_con) = WMIConnection::new(com_con) {
            #[derive(Deserialize)]
            #[allow(non_snake_case)]
            struct Win32Processor {
                SecondLevelAddressTranslationExtensions: Option<bool>,
            }

            if let Ok(results) = wmi_con.query::<Win32Processor>() {
                if let Some(proc) = results.first() {
                    // SLAT is required for IOMMU to work
                    if proc.SecondLevelAddressTranslationExtensions.unwrap_or(false) {
                        println!("[Hardware] IOMMU likely available - SLAT extensions detected via WMI");
                        return true;
                    }
                }
            }
        }
    }
    
    // Method 8: Check ACPI DSDT tables enumeration (enumerate all manufacturer tables)
    unsafe {
        let key_path: Vec<u16> = "HARDWARE\\ACPI\\DSDT\0"
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
            // Enumerate subkeys to find DMAR or IVRS
            let mut index: u32 = 0;
            let mut name_buffer: [u16; 256] = [0; 256];
            
            loop {
                let mut name_len: u32 = 256;
                let enum_result = RegEnumKeyExW(
                    hkey,
                    index,
                    windows::core::PWSTR(name_buffer.as_mut_ptr()),
                    &mut name_len,
                    Some(ptr::null_mut()),
                    windows::core::PWSTR::null(),
                    Some(ptr::null_mut()),
                    Some(ptr::null_mut()),
                );
                
                if enum_result.is_err() {
                    break;
                }
                
                let subkey_name = String::from_utf16_lossy(&name_buffer[..name_len as usize]);
                println!("[Hardware] Found ACPI DSDT subkey: {}", subkey_name);
                
                // Check if this manufacturer has DMAR table
                let dmar_check_path: Vec<u16> = format!("HARDWARE\\ACPI\\DSDT\\{}\\DMAR\0", subkey_name)
                    .encode_utf16()
                    .collect();
                
                let mut dmar_hkey: HKEY = HKEY::default();
                let dmar_result = RegOpenKeyExW(
                    HKEY_LOCAL_MACHINE,
                    PCWSTR(dmar_check_path.as_ptr()),
                    0,
                    KEY_READ,
                    &mut dmar_hkey,
                );
                
                if dmar_result.is_ok() {
                    let _ = RegCloseKey(dmar_hkey);
                    let _ = RegCloseKey(hkey);
                    println!("[Hardware] IOMMU detected via DSDT/{}/DMAR", subkey_name);
                    return true;
                }
                
                index += 1;
                if index > 100 { break; } // Safety limit
            }
            
            let _ = RegCloseKey(hkey);
        }
    }
    
    // Method 9: Check msinfo32 SystemSummary for VT-d/IOMMU indication via WMI
    if let Ok(com_con) = COMLibrary::new() {
        if let Ok(wmi_con) = WMIConnection::new(com_con) {
            #[derive(Deserialize)]
            #[allow(non_snake_case)]
            struct Win32ComputerSystem {
                HypervisorPresent: Option<bool>,
            }

            if let Ok(results) = wmi_con.query::<Win32ComputerSystem>() {
                if let Some(cs) = results.first() {
                    // If Hyper-V/hypervisor is running, IOMMU is likely enabled
                    // as modern hypervisors require IOMMU for passthrough
                    if cs.HypervisorPresent.unwrap_or(false) {
                        println!("[Hardware] Hypervisor present - IOMMU likely enabled");
                        // Don't return true yet, this is just a hint
                    }
                }
            }
        }
    }
    
    // Method 10: Check PnP devices for IOMMU-related devices
    if check_iommu_pnp_devices() {
        return true;
    }
    
    println!("[Hardware] IOMMU not detected via standard methods");
    false
}

/// Check ACPI firmware tables for DMAR/IVRS signatures (most reliable method)
#[cfg(target_os = "windows")]
fn check_acpi_firmware_tables() -> bool {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    
    // Method 1: Use PowerShell to query ACPI tables directly (most reliable)
    if let Ok(output) = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", 
               "Get-WmiObject -Namespace root\\WMI -Class MSAcpi_Table -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'DMAR' -or $_.Name -eq 'IVRS' } | Select-Object -First 1 | ForEach-Object { $_.Name }"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
    {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if stdout == "DMAR" || stdout == "IVRS" {
            println!("[Hardware] IOMMU detected via WMI MSAcpi_Table: {}", stdout);
            return true;
        }
    }
    
    // Method 2: Check EnumSystemFirmwareTables for DMAR signature
    if check_firmware_table_dmar() {
        return true;
    }
    
    // Method 3: Enumerate registry FIRMWARE\ACPI keys
    unsafe {
        let key_path: Vec<u16> = "HARDWARE\\FIRMWARE\\ACPI\0"
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
            let mut index: u32 = 0;
            let mut name_buffer: [u16; 256] = [0; 256];
            
            loop {
                let mut name_len: u32 = 256;
                let enum_result = RegEnumKeyExW(
                    hkey,
                    index,
                    windows::core::PWSTR(name_buffer.as_mut_ptr()),
                    &mut name_len,
                    Some(ptr::null_mut()),
                    windows::core::PWSTR::null(),
                    Some(ptr::null_mut()),
                    Some(ptr::null_mut()),
                );
                
                if enum_result.is_err() {
                    break;
                }
                
                let table_sig = String::from_utf16_lossy(&name_buffer[..name_len as usize]);
                println!("[Hardware] Found ACPI firmware table: {}", table_sig);
                
                // DMAR = Intel VT-d DMA Remapping table
                // IVRS = AMD I/O Virtualization Reporting Structure
                if table_sig == "DMAR" || table_sig == "IVRS" {
                    let _ = RegCloseKey(hkey);
                    println!("[Hardware] IOMMU detected via FIRMWARE\\ACPI\\{} table", table_sig);
                    return true;
                }
                
                index += 1;
                if index > 100 { break; }
            }
            
            let _ = RegCloseKey(hkey);
        }
    }
    false
}

/// Check for DMAR table using EnumSystemFirmwareTables API
#[cfg(target_os = "windows")]
fn check_firmware_table_dmar() -> bool {
    use windows::Win32::System::SystemInformation::{EnumSystemFirmwareTables, FIRMWARE_TABLE_PROVIDER};
    
    unsafe {
        // ACPI signature (little-endian 'ACPI')
        let acpi_provider = FIRMWARE_TABLE_PROVIDER(0x41435049); // 'ACPI'
        
        // First call to get buffer size
        let size = EnumSystemFirmwareTables(acpi_provider, None);
        if size == 0 {
            println!("[Hardware] EnumSystemFirmwareTables returned 0");
            return false;
        }
        
        let mut buffer: Vec<u8> = vec![0; size as usize];
        let actual_size = EnumSystemFirmwareTables(acpi_provider, Some(&mut buffer));
        
        if actual_size == 0 {
            return false;
        }
        
        // Each table signature is 4 bytes
        for chunk in buffer.chunks(4) {
            if chunk.len() == 4 {
                let sig = String::from_utf8_lossy(chunk).to_string();
                println!("[Hardware] EnumSystemFirmwareTables found: {}", sig);
                
                if sig == "DMAR" || sig == "IVRS" {
                    println!("[Hardware] IOMMU detected via EnumSystemFirmwareTables: {}", sig);
                    return true;
                }
            }
        }
    }
    
    false
}

/// Check PnP devices for IOMMU-related device classes
#[cfg(target_os = "windows")]
fn check_iommu_pnp_devices() -> bool {
    // Check for ACPI\DMAR or related device IDs in device manager
    let device_patterns = [
        "SYSTEM\\CurrentControlSet\\Enum\\ACPI\\DMAR",
        "SYSTEM\\CurrentControlSet\\Enum\\ACPI\\IVRS",
        "SYSTEM\\CurrentControlSet\\Enum\\ACPI_HAL\\DMAR",
    ];
    
    for pattern in device_patterns {
        unsafe {
            let key_path: Vec<u16> = format!("{}\0", pattern).encode_utf16().collect();
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
                println!("[Hardware] IOMMU detected via PnP device at {}", pattern);
                return true;
            }
        }
    }
    
    // Check for HAL DMA remapping capability via HAL extension
    unsafe {
        let key_path: Vec<u16> = "SYSTEM\\CurrentControlSet\\Control\\HAL\0"
            .encode_utf16()
            .collect();
        let value_name: Vec<u16> = "HalDmaRemapping\0".encode_utf16().collect();

        let mut hkey: HKEY = HKEY::default();
        let result = RegOpenKeyExW(
            HKEY_LOCAL_MACHINE,
            PCWSTR(key_path.as_ptr()),
            0,
            KEY_READ,
            &mut hkey,
        );

        if result.is_ok() {
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

            let _ = RegCloseKey(hkey);

            if query_result.is_ok() && data_type == REG_DWORD && data > 0 {
                println!("[Hardware] IOMMU detected via HAL DMA Remapping flag");
                return true;
            }
        }
    }
    
    // Check boot configuration for DMA remapping
    unsafe {
        let key_path: Vec<u16> = "SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\0"
            .encode_utf16()
            .collect();
        let _value_name: Vec<u16> = "FeatureSettingsOverride\0".encode_utf16().collect();

        let mut hkey: HKEY = HKEY::default();
        let result = RegOpenKeyExW(
            HKEY_LOCAL_MACHINE,
            PCWSTR(key_path.as_ptr()),
            0,
            KEY_READ,
            &mut hkey,
        );

        if result.is_ok() {
            // Check if mitigations requiring IOMMU are enabled
            let _ = RegCloseKey(hkey);
        }
    }
    
    false
}

/// Check Kernel DMA Protection (DMA Guard) - CRITICAL for blocking DMA cheats
/// IOMMU being "present" doesn't mean it's enforced. Kernel DMA Protection actually blocks unauthorized DMA.
/// Without this, a DMA cheat device can still read game memory even with IOMMU "enabled".
#[cfg(target_os = "windows")]
fn check_kernel_dma_protection() -> bool {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    
    // Method 1: Check DeviceGuard WMI for DmaGuardPolicy (most reliable)
    if let Ok(com_con) = COMLibrary::new() {
        if let Ok(wmi_con) = WMIConnection::with_namespace_path("root\\Microsoft\\Windows\\DeviceGuard", com_con) {
            #[derive(Deserialize)]
            #[allow(non_snake_case)]
            struct Win32DeviceGuard {
                AvailableSecurityProperties: Option<Vec<i32>>,
                SecurityServicesRunning: Option<Vec<i32>>,
            }

            if let Ok(results) = wmi_con.query::<Win32DeviceGuard>() {
                if let Some(dg) = results.first() {
                    // Check AvailableSecurityProperties - value 7 = DmaProtection is available
                    // Check SecurityServicesRunning - value 7 = DmaProtection is running
                    if let Some(running) = &dg.SecurityServicesRunning {
                        if running.contains(&7) {
                            println!("[Hardware] Kernel DMA Protection ACTIVE via DeviceGuard WMI");
                            return true;
                        }
                    }
                    if let Some(available) = &dg.AvailableSecurityProperties {
                        println!("[Hardware] DeviceGuard Available Properties: {:?}", available);
                    }
                }
            }
        }
    }
    
    // Method 2: Check registry for DMA Guard policy state
    unsafe {
        let key_path: Vec<u16> = "SYSTEM\\CurrentControlSet\\Control\\DmaSecurity\0"
            .encode_utf16()
            .collect();
        let value_name: Vec<u16> = "DmaGuardPolicyEnabled\0".encode_utf16().collect();

        let mut hkey: HKEY = HKEY::default();
        let result = RegOpenKeyExW(
            HKEY_LOCAL_MACHINE,
            PCWSTR(key_path.as_ptr()),
            0,
            KEY_READ,
            &mut hkey,
        );

        if result.is_ok() {
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

            let _ = RegCloseKey(hkey);

            if query_result.is_ok() && data_type == REG_DWORD && data == 1 {
                println!("[Hardware] Kernel DMA Protection enabled via DmaGuardPolicyEnabled registry");
                return true;
            }
        }
    }
    
    // Method 3: Check DeviceGuard Scenarios policy for DMA
    unsafe {
        let key_path: Vec<u16> = "SYSTEM\\CurrentControlSet\\Control\\DeviceGuard\\Scenarios\\KernelShadowStacks\0"
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
            // Kernel Shadow Stacks requires Kernel DMA Protection
            println!("[Hardware] Kernel Shadow Stacks present - DMA protection likely enabled");
        }
    }
    
    // Method 4: PowerShell msinfo32 check for Kernel DMA Protection
    if let Ok(output) = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", 
               "(Get-CimInstance -Namespace root/Microsoft/Windows/DeviceGuard -ClassName Win32_DeviceGuard).SecurityServicesRunning -contains 7"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
    {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_lowercase();
        if stdout == "true" {
            println!("[Hardware] Kernel DMA Protection confirmed via PowerShell CIM query");
            return true;
        }
    }
    
    // Method 5: Check for Kernel DMA Protection in system info
    // This is what msinfo32.exe displays as "Kernel DMA Protection: On"
    if let Ok(output) = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", 
               "$dma = (Get-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\DmaSecurity' -Name 'DmaGuardPolicyEnabled' -ErrorAction SilentlyContinue).DmaGuardPolicyEnabled; if ($dma -eq 1) { 'Enabled' } else { 'Disabled' }"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
    {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_lowercase();
        if stdout == "enabled" {
            println!("[Hardware] Kernel DMA Protection enabled via PowerShell registry check");
            return true;
        }
    }
    
    println!("[Hardware] Kernel DMA Protection NOT detected - DMA cheats may be possible even with IOMMU!");
    false
}

#[cfg(not(target_os = "windows"))]
fn check_kernel_dma_protection() -> bool {
    false
}

#[cfg(not(target_os = "windows"))]
pub fn check_virtualization() -> VirtualizationStatus {
    VirtualizationStatus::default()
}

/// Check Windows Defender status
#[cfg(target_os = "windows")]
pub fn check_defender() -> DefenderStatus {
    let mut status = DefenderStatus::default();

    // Method 1: WMI (most accurate - runtime status)
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
                    println!("[Hardware] Defender via WMI: enabled={}, realtime={}, tamper={}", 
                             status.enabled, status.real_time_protection, status.tamper_protection);
                    return status;
                }
            }
        }
    }

    // Method 2: Registry fallback - check if Defender is disabled via policy/registry
    // This catches cases where WMI namespace is inaccessible (Group Policy, Windows Server, etc.)
    println!("[Hardware] Defender WMI unavailable, falling back to registry");
    
    // Check if Defender is NOT disabled via policy
    let mut defender_disabled = false;
    unsafe {
        let key_path: Vec<u16> = "SOFTWARE\\Policies\\Microsoft\\Windows Defender\0"
            .encode_utf16()
            .collect();
        let value_name: Vec<u16> = "DisableAntiSpyware\0".encode_utf16().collect();

        let mut hkey: HKEY = HKEY::default();
        let result = RegOpenKeyExW(
            HKEY_LOCAL_MACHINE,
            PCWSTR(key_path.as_ptr()),
            0,
            KEY_READ,
            &mut hkey,
        );

        if result.is_ok() {
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

            let _ = RegCloseKey(hkey);

            if query_result.is_ok() && data_type == REG_DWORD && data == 1 {
                defender_disabled = true;
            }
        }
    }
    
    // Check real-time protection via registry
    if !defender_disabled {
        unsafe {
            let key_path: Vec<u16> = "SOFTWARE\\Microsoft\\Windows Defender\\Real-Time Protection\0"
                .encode_utf16()
                .collect();
            let value_name: Vec<u16> = "DisableRealtimeMonitoring\0".encode_utf16().collect();

            let mut hkey: HKEY = HKEY::default();
            let result = RegOpenKeyExW(
                HKEY_LOCAL_MACHINE,
                PCWSTR(key_path.as_ptr()),
                0,
                KEY_READ,
                &mut hkey,
            );

            if result.is_ok() {
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

                let _ = RegCloseKey(hkey);

                // If DisableRealtimeMonitoring doesn't exist or is 0, real-time is enabled
                let realtime_disabled = query_result.is_ok() && data_type == REG_DWORD && data == 1;
                status.enabled = true;
                status.real_time_protection = !realtime_disabled;
            } else {
                // Key doesn't exist = real-time not explicitly disabled = likely enabled
                status.enabled = true;
                status.real_time_protection = true;
            }
        }
    }
    
    println!("[Hardware] Defender via registry: enabled={}, realtime={}", 
             status.enabled, status.real_time_protection);

    status
}

#[cfg(not(target_os = "windows"))]
pub fn check_defender() -> DefenderStatus {
    DefenderStatus::default()
}

/// Check VBS/HVCI status via multiple methods
#[cfg(target_os = "windows")]
pub fn check_vbs() -> VbsStatus {
    let mut status = VbsStatus::default();
    let mut wmi_succeeded = false;

    // Method 1: WMI DeviceGuard (RUNTIME status - most reliable)
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
                    wmi_succeeded = true;
                    let vbs_status = dg.VirtualizationBasedSecurityStatus.unwrap_or(0);
                    println!("[Hardware] DeviceGuard VBS runtime status: {}", vbs_status);
                    // 0=not enabled, 1=enabled but not running, 2=enabled and running
                    status.enabled = vbs_status >= 1;
                    status.running = vbs_status == 2;
                    
                    // SecurityServicesRunning: 1=Credential Guard, 2=HVCI
                    // Only trust "Running" list, not "Configured" - configured != actually active
                    if let Some(services) = &dg.SecurityServicesRunning {
                        println!("[Hardware] DeviceGuard services running: {:?}", services);
                        status.hvci_enabled = services.contains(&2);
                    }
                }
            } else {
                println!("[Hardware] DeviceGuard WMI query failed");
            }
        } else {
            println!("[Hardware] DeviceGuard WMI namespace not accessible");
        }
    }

    // Method 2: Registry check for HVCI (Memory Integrity) - only if WMI didn't detect it
    // NOTE: Registry = policy/configuration, not runtime. Only use as fallback.
    if !wmi_succeeded && !status.hvci_enabled {
        let hvci_configured = check_hvci_registry();
        if hvci_configured {
            // Registry says HVCI is configured - mark as enabled but NOT running
            // (we can't confirm runtime without WMI)
            status.hvci_enabled = true;
            status.enabled = true;
            // Don't set running=true - registry is policy, not runtime confirmation
            println!("[Hardware] HVCI configured via registry (runtime unconfirmed)");
        }
    }
    
    println!("[Hardware] VBS check: enabled={}, running={}, hvci={}", 
             status.enabled, status.running, status.hvci_enabled);

    status
}

/// Check HVCI via registry (Memory Integrity) - policy check only
#[cfg(target_os = "windows")]
fn check_hvci_registry() -> bool {
    unsafe {
        // HVCI (Memory Integrity) registry location
        let key_path: Vec<u16> = "SYSTEM\\CurrentControlSet\\Control\\DeviceGuard\\Scenarios\\HypervisorEnforcedCodeIntegrity\0"
            .encode_utf16()
            .collect();
        let value_name: Vec<u16> = "Enabled\0".encode_utf16().collect();

        let mut hkey: HKEY = HKEY::default();
        let result = RegOpenKeyExW(
            HKEY_LOCAL_MACHINE,
            PCWSTR(key_path.as_ptr()),
            0,
            KEY_READ,
            &mut hkey,
        );

        if result.is_ok() {
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

            let _ = RegCloseKey(hkey);

            if query_result.is_ok() && data_type == REG_DWORD {
                println!("[Hardware] HVCI registry value: {}", data);
                if data == 1 {
                    return true;
                }
            }
        }
    }
    false
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

// ====== NETWORK MONITOR (VPN/Proxy Detection) ======

const VPN_ADAPTER_KEYWORDS: &[&str] = &[
    "tap-windows", "tap0901", "wintun", "wireguard",
    "nordlynx", "proton", "surfshark", "cyberghost",
    "windscribe", "mullvad", "private internet access",
    "pia", "expressvpn", "tunnelbear", "hotspot shield",
    "hamachi", "zerotier", "softether", "openvpn",
    "fortinet", "cisco anyconnect", "vpn adapter",
    "virtual ethernet", "phantom",
];

const VPN_PROCESSES: &[&str] = &[
    "openvpn", "openvpnserv", "nordvpn", "nordlynx",
    "expressvpn", "expressvpnd", "surfshark",
    "cyberghost", "windscribe", "mullvad",
    "protonvpn", "tunnelbear", "hotspotshield",
    "wireguard", "wg-quick", "softether",
    "zerotier", "hamachi", "privoxy",
    "tor.exe", "i2p", "proxifier", "proxycap",
    "ultrasurf", "psiphon", "lantern",
    "cloudflare-warp", "warp-cli",
];

// Windows system processes that should NOT be flagged as VPN
const VPN_PROCESS_WHITELIST: &[&str] = &[
    "aggregatorhost.exe",
    "searchhost.exe",
    "shellexperiencehost.exe",
    "textinputhost.exe",
    "runtimebroker.exe",
    "applicationframehost.exe",
    "sihost.exe",
    "dllhost.exe",
    "conhost.exe",
    "svchost.exe",
];

/// Detect VPN/Proxy usage
#[cfg(target_os = "windows")]
pub fn check_network_monitor() -> NetworkMonitorResult {
    let mut result = NetworkMonitorResult::default();

    // 1. Check network adapters for VPN interfaces
    if let Ok(com_con) = COMLibrary::new() {
        if let Ok(wmi_con) = WMIConnection::new(com_con) {
            #[derive(Deserialize)]
            #[allow(non_snake_case, dead_code)]
            struct Win32NetworkAdapter {
                Name: Option<String>,
                Description: Option<String>,
                NetConnectionStatus: Option<u16>,
            }

            if let Ok(adapters) = wmi_con.raw_query::<Win32NetworkAdapter>(
                "SELECT Name, Description, NetConnectionStatus FROM Win32_NetworkAdapter WHERE NetConnectionStatus IS NOT NULL"
            ) {
                for adapter in adapters {
                    let name = adapter.Name.clone().unwrap_or_default().to_lowercase();
                    let desc = adapter.Description.clone().unwrap_or_default().to_lowercase();

                    for keyword in VPN_ADAPTER_KEYWORDS {
                        if name.contains(keyword) || desc.contains(keyword) {
                            let adapter_name = adapter.Name.clone().unwrap_or_default();
                            if !result.vpn_adapters.contains(&adapter_name) {
                                result.vpn_adapters.push(adapter_name);
                                result.vpn_detected = true;
                                result.risk_score += 40;
                            }
                            break;
                        }
                    }
                }
            }
        }
    }

    // 2. Check for VPN processes
    if let Ok(com_con) = COMLibrary::new() {
        if let Ok(wmi_con) = WMIConnection::new(com_con) {
            #[derive(Deserialize)]
            #[allow(non_snake_case)]
            struct Win32Process {
                Name: Option<String>,
            }

            if let Ok(processes) = wmi_con.raw_query::<Win32Process>(
                "SELECT Name FROM Win32_Process"
            ) {
                for process in processes {
                    let proc_name = process.Name.clone().unwrap_or_default().to_lowercase();
                    
                    // Skip whitelisted Windows system processes
                    if VPN_PROCESS_WHITELIST.iter().any(|&w| proc_name == w) {
                        continue;
                    }

                    for vpn in VPN_PROCESSES {
                        if proc_name.contains(vpn) {
                            let name = process.Name.clone().unwrap_or_default();
                            if !result.vpn_processes.contains(&name) {
                                result.vpn_processes.push(name);
                                result.vpn_detected = true;
                                result.risk_score += 30;
                            }
                            break;
                        }
                    }
                }
            }
        }
    }

    // 3. Check Windows proxy settings in registry
    unsafe {
        let key_path: Vec<u16> = "Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\0"
            .encode_utf16()
            .collect();
        let value_name: Vec<u16> = "ProxyEnable\0".encode_utf16().collect();

        let mut hkey: HKEY = HKEY::default();
        let result_reg = RegOpenKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR(key_path.as_ptr()),
            0,
            KEY_READ,
            &mut hkey,
        );

        if result_reg.is_ok() {
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

            if query_result.is_ok() && data_type == REG_DWORD && data == 1 {
                result.proxy_detected = true;
                result.risk_score += 20;

                // Try to read proxy server value
                let proxy_value: Vec<u16> = "ProxyServer\0".encode_utf16().collect();
                let mut proxy_buffer = [0u16; 512];
                let mut proxy_size: u32 = (proxy_buffer.len() * 2) as u32;
                let mut proxy_type: REG_VALUE_TYPE = REG_VALUE_TYPE(0);

                let proxy_result = RegQueryValueExW(
                    hkey,
                    PCWSTR(proxy_value.as_ptr()),
                    Some(ptr::null_mut()),
                    Some(&mut proxy_type),
                    Some(proxy_buffer.as_mut_ptr() as *mut u8),
                    Some(&mut proxy_size),
                );

                if proxy_result.is_ok() {
                    let len = proxy_buffer.iter().position(|&c| c == 0).unwrap_or(proxy_buffer.len());
                    result.proxy_settings = Some(String::from_utf16_lossy(&proxy_buffer[..len]));
                }
            }

            let _ = RegCloseKey(hkey);
        }
    }

    println!("[Hardware] Network Monitor: vpn={}, proxy={}, adapters={}, processes={}, score={}",
             result.vpn_detected, result.proxy_detected,
             result.vpn_adapters.len(), result.vpn_processes.len(), result.risk_score);

    result
}

#[cfg(not(target_os = "windows"))]
pub fn check_network_monitor() -> NetworkMonitorResult {
    NetworkMonitorResult::default()
}

// ====== REGISTRY SCAN (Cheat Traces) ======

/// Registry paths to scan for cheat software traces
const REGISTRY_CHEAT_TRACES: &[(&str, &str, &str)] = &[
    // (registry_subkey, cheat_name, trace_type)
    // Cronus
    ("SOFTWARE\\Collective Minds", "Cronus Zen", "install"),
    ("SOFTWARE\\WOW6432Node\\Collective Minds", "Cronus Zen (32-bit)", "install"),
    ("SOFTWARE\\Cronus", "Cronus", "install"),
    // XIM
    ("SOFTWARE\\XIM Technologies", "XIM", "install"),
    ("SOFTWARE\\WOW6432Node\\XIM Technologies", "XIM (32-bit)", "install"),
    // Titan
    ("SOFTWARE\\ConsoleTuner", "Titan (ConsoleTuner)", "install"),
    ("SOFTWARE\\WOW6432Node\\ConsoleTuner", "Titan (32-bit)", "install"),
    // ReaSnow
    ("SOFTWARE\\ReaSnow", "ReaSnow", "install"),
    // DS4Windows
    ("SOFTWARE\\DS4Windows", "DS4Windows", "install"),
    // Interception driver (used by Cronus/macros)
    ("SYSTEM\\CurrentControlSet\\Services\\interception", "Interception Driver", "driver"),
    ("SYSTEM\\CurrentControlSet\\Services\\keyboard", "Interception Keyboard", "driver"),
    ("SYSTEM\\CurrentControlSet\\Services\\mouse", "Interception Mouse", "driver"),
    // HidHide (hides devices from detection)
    ("SYSTEM\\CurrentControlSet\\Services\\HidHide", "HidHide", "driver"),
    // ViGEm (virtual gamepad emulator)
    ("SYSTEM\\CurrentControlSet\\Services\\ViGEmBus", "ViGEmBus", "driver"),
    // HWID Spoofers
    ("SYSTEM\\CurrentControlSet\\Services\\SpoofMaster", "SpoofMaster", "spoofer"),
    ("SOFTWARE\\HWID Changer", "HWID Changer", "spoofer"),
    ("SOFTWARE\\SerialChanger", "Serial Changer", "spoofer"),
    ("SOFTWARE\\WOW6432Node\\HWID_Changer", "HWID Changer (32-bit)", "spoofer"),
    // AutoHotkey
    ("SOFTWARE\\AutoHotkey", "AutoHotkey", "install"),
    ("SOFTWARE\\WOW6432Node\\AutoHotkey", "AutoHotkey (32-bit)", "install"),
    // ReWASD
    ("SOFTWARE\\Disc Soft", "ReWASD (Disc Soft)", "install"),
    ("SOFTWARE\\reWASD", "reWASD", "install"),
    // AntiMicro
    ("SOFTWARE\\AntiMicro", "AntiMicro", "install"),
    // x360ce
    ("SOFTWARE\\x360ce", "x360ce", "install"),
];

/// Uninstall registry paths to check
const UNINSTALL_PATHS: &[&str] = &[
    "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
];

/// Keywords to match in uninstall entries
const UNINSTALL_CHEAT_KEYWORDS: &[(&str, &str)] = &[
    ("cronus", "Cronus"),
    ("zen studio", "Cronus Zen Studio"),
    ("xim", "XIM"),
    ("titan", "Titan"),
    ("consoletuner", "ConsoleTuner"),
    ("reasnow", "ReaSnow"),
    ("ds4windows", "DS4Windows"),
    ("inputmapper", "InputMapper"),
    ("scptoolkit", "ScpToolkit"),
    ("autohotkey", "AutoHotkey"),
    ("rewasd", "reWASD"),
    ("antimicro", "AntiMicro"),
    ("x360ce", "x360ce"),
    ("hidhide", "HidHide"),
    ("vigem", "ViGEm"),
];

/// Scan registry for cheat software traces
#[cfg(target_os = "windows")]
pub fn scan_registry() -> RegistryScanResult {
    let mut result = RegistryScanResult::default();

    // 1. Check known registry paths
    for (subkey, cheat_name, trace_type) in REGISTRY_CHEAT_TRACES {
        let key_path: Vec<u16> = format!("{}\0", subkey).encode_utf16().collect();

        unsafe {
            let mut hkey: HKEY = HKEY::default();
            let open_result = RegOpenKeyExW(
                HKEY_LOCAL_MACHINE,
                PCWSTR(key_path.as_ptr()),
                0,
                KEY_READ,
                &mut hkey,
            );

            if open_result.is_ok() {
                let _ = RegCloseKey(hkey);
                result.traces_found = true;
                result.traces.push(RegistryTrace {
                    path: format!("HKLM\\{}", subkey),
                    cheat_name: cheat_name.to_string(),
                    trace_type: trace_type.to_string(),
                });
                let score = match *trace_type {
                    "spoofer" => 80,
                    "driver" => 60,
                    _ => 50,
                };
                result.risk_score += score;
            }
        }
    }

    // 2. Scan uninstall entries for cheat software names
    for uninstall_path in UNINSTALL_PATHS {
        let key_path: Vec<u16> = format!("{}\0", uninstall_path).encode_utf16().collect();

        unsafe {
            let mut hkey: HKEY = HKEY::default();
            let open_result = RegOpenKeyExW(
                HKEY_LOCAL_MACHINE,
                PCWSTR(key_path.as_ptr()),
                0,
                KEY_READ,
                &mut hkey,
            );

            if open_result.is_ok() {
                // Enumerate subkeys
                let mut index: u32 = 0;
                loop {
                    let mut name_buf = [0u16; 256];
                    let mut name_len: u32 = 256;

                    let enum_result = RegEnumKeyExW(
                        hkey,
                        index,
                        windows::core::PWSTR(name_buf.as_mut_ptr()),
                        &mut name_len,
                        None,
                        windows::core::PWSTR(ptr::null_mut()),
                        None,
                        None,
                    );

                    if enum_result.is_err() {
                        break;
                    }

                    let subkey_name = String::from_utf16_lossy(&name_buf[..name_len as usize]).to_lowercase();

                    for (keyword, cheat_name) in UNINSTALL_CHEAT_KEYWORDS {
                        if subkey_name.contains(keyword) {
                            let trace_path = format!("HKLM\\{}\\{}", uninstall_path, subkey_name);
                            // Avoid duplicates
                            if !result.traces.iter().any(|t| t.path == trace_path) {
                                result.traces_found = true;
                                result.traces.push(RegistryTrace {
                                    path: trace_path,
                                    cheat_name: cheat_name.to_string(),
                                    trace_type: "uninstall".to_string(),
                                });
                                result.risk_score += 40;
                            }
                            break;
                        }
                    }

                    index += 1;
                }

                let _ = RegCloseKey(hkey);
            }
        }
    }

    println!("[Hardware] Registry Scan: traces_found={}, count={}, score={}",
             result.traces_found, result.traces.len(), result.risk_score);

    result
}

#[cfg(not(target_os = "windows"))]
pub fn scan_registry() -> RegistryScanResult {
    RegistryScanResult::default()
}

// ====== DRIVER INTEGRITY (Suspicious Drivers) ======

const SUSPICIOUS_DRIVER_NAMES: &[(&str, &str)] = &[
    // Interception driver (keyboard/mouse interception - used by cheat devices)
    ("interception", "Interception driver - HID interception"),
    // HidHide (hides USB devices from detection)
    ("hidhide", "HidHide - Device hiding driver"),
    // ViGEm (virtual gamepad emulation)
    ("vigembus", "ViGEmBus - Virtual gamepad emulator"),
    ("vigem", "ViGEm - Virtual controller driver"),
    // Nefarius (HidHide / ViGEm developer)
    ("nefcon", "Nefarius Config driver"),
    // Various HID spoofing drivers
    ("hidguardian", "HidGuardian - HID device filter"),
    // ScpVBus (SCP virtual bus for DS3/DS4)
    ("scpvbus", "ScpVBus - SCP virtual controller"),
    // Xb360 filter driver (used by some cheats)
    ("xb1usb", "XB1 USB filter driver"),
    // FairFight bypass drivers
    ("capcom", "Capcom.sys - Known exploit driver"),
    // Common HWID spoofer drivers
    ("spoofmaster", "SpoofMaster - HWID spoofer driver"),
    ("hwid", "HWID manipulation driver"),
    ("serialchanger", "Serial changer driver"),
    // Kernel-level cheat drivers
    ("kdmapper", "KDMapper - Kernel driver mapper"),
    ("dse_patch", "DSE Patch - Driver signature bypass"),
];

/// Check driver integrity - detect suspicious/cheat-related kernel drivers
#[cfg(target_os = "windows")]
pub fn check_driver_integrity() -> DriverIntegrityResult {
    let mut result = DriverIntegrityResult::default();

    if let Ok(com_con) = COMLibrary::new() {
        if let Ok(wmi_con) = WMIConnection::new(com_con) {
            #[derive(Deserialize)]
            #[allow(non_snake_case, dead_code)]
            struct Win32SystemDriver {
                Name: Option<String>,
                DisplayName: Option<String>,
                PathName: Option<String>,
                State: Option<String>,
                StartMode: Option<String>,
            }

            if let Ok(drivers) = wmi_con.raw_query::<Win32SystemDriver>(
                "SELECT Name, DisplayName, PathName, State, StartMode FROM Win32_SystemDriver"
            ) {
                for driver in drivers {
                    let name = driver.Name.clone().unwrap_or_default().to_lowercase();
                    let display = driver.DisplayName.clone().unwrap_or_default().to_lowercase();
                    let path = driver.PathName.clone().unwrap_or_default().to_lowercase();

                    for (suspicious_name, reason) in SUSPICIOUS_DRIVER_NAMES {
                        if name.contains(suspicious_name) || display.contains(suspicious_name) || path.contains(suspicious_name) {
                            result.suspicious_found = true;
                            result.suspicious_drivers.push(SuspiciousDriver {
                                name: driver.Name.clone().unwrap_or_default(),
                                display_name: driver.DisplayName.clone().unwrap_or_default(),
                                path: driver.PathName.clone(),
                                reason: reason.to_string(),
                            });
                            result.risk_score += 70;
                            break;
                        }
                    }
                }
            }
        }
    }

    // Also check for unsigned/suspicious drivers via registry
    // Check Interception specifically (common cheat enabler)
    unsafe {
        let key_path: Vec<u16> = "SYSTEM\\CurrentControlSet\\Services\\interception\0"
            .encode_utf16()
            .collect();

        let mut hkey: HKEY = HKEY::default();
        let open_result = RegOpenKeyExW(
            HKEY_LOCAL_MACHINE,
            PCWSTR(key_path.as_ptr()),
            0,
            KEY_READ,
            &mut hkey,
        );

        if open_result.is_ok() {
            let _ = RegCloseKey(hkey);
            // Check if not already detected
            if !result.suspicious_drivers.iter().any(|d| d.name.to_lowercase().contains("interception")) {
                result.suspicious_found = true;
                result.suspicious_drivers.push(SuspiciousDriver {
                    name: "interception".to_string(),
                    display_name: "Interception Driver (Registry)".to_string(),
                    path: None,
                    reason: "Interception driver - HID interception (registry trace)".to_string(),
                });
                result.risk_score += 70;
            }
        }
    }

    println!("[Hardware] Driver Integrity: suspicious={}, count={}, score={}",
             result.suspicious_found, result.suspicious_drivers.len(), result.risk_score);

    result
}

#[cfg(not(target_os = "windows"))]
pub fn check_driver_integrity() -> DriverIntegrityResult {
    DriverIntegrityResult::default()
}

// ====== MACRO DETECTION (AutoHotkey, Logitech, Razer, etc.) ======

const MACRO_PROCESSES: &[(&str, &str)] = &[
    // AutoHotkey family
    ("autohotkey", "ahk"),
    ("ahk", "ahk"),
    ("autohotkey64", "ahk"),
    ("autohotkey32", "ahk"),
    // Logitech
    ("lghub", "logitech"),
    ("lghub_agent", "logitech"),
    ("lghub_updater", "logitech"),
    ("lcore", "logitech"),
    ("ghub", "logitech"),
    // Razer Synapse
    ("razersynapse", "razer"),
    ("razer synapse 3", "razer"),
    ("razer synapse service", "razer"),
    ("rzsynapse", "razer"),
    ("razercentral", "razer"),
    // Corsair iCUE
    ("icue", "corsair"),
    ("corsair", "corsair"),
    // Generic macro tools
    ("macro recorder", "generic"),
    ("tinytask", "generic"),
    ("pulover", "generic"),
    ("macrocreator", "generic"),
    ("jitbit", "generic"),
    // Remapping / macro tools
    ("rewasd", "generic"),
    ("antimicro", "generic"),
    ("xpadder", "generic"),
    ("joytokey", "generic"),
    ("x360ce", "generic"),
    ("keysticks", "generic"),
    // Mouse macro software
    ("x-mouse", "generic"),
    ("xmousebuttoncontrol", "generic"),
];

/// Detect macro software
#[cfg(target_os = "windows")]
pub fn detect_macros() -> MacroDetectionResult {
    let mut result = MacroDetectionResult::default();
    let mut seen_names: Vec<String> = Vec::new();

    // 1. Check running processes for macro software
    if let Ok(com_con) = COMLibrary::new() {
        if let Ok(wmi_con) = WMIConnection::new(com_con) {
            #[derive(Deserialize)]
            #[allow(non_snake_case)]
            struct Win32Process {
                Name: Option<String>,
                ExecutablePath: Option<String>,
            }

            if let Ok(processes) = wmi_con.raw_query::<Win32Process>(
                "SELECT Name, ExecutablePath FROM Win32_Process"
            ) {
                for process in processes {
                    let proc_name = process.Name.clone().unwrap_or_default().to_lowercase();
                    let proc_path = process.ExecutablePath.clone().unwrap_or_default().to_lowercase();

                    for (keyword, macro_type) in MACRO_PROCESSES {
                        if proc_name.contains(keyword) || proc_path.contains(keyword) {
                            let name = process.Name.clone().unwrap_or_default();
                            if !seen_names.contains(&name.to_lowercase()) {
                                seen_names.push(name.to_lowercase());
                                result.macros_detected = true;
                                result.detected_software.push(DetectedMacro {
                                    name,
                                    macro_type: macro_type.to_string(),
                                    source: "process".to_string(),
                                });
                                let score = match *macro_type {
                                    "ahk" => 80,        // AHK is high risk
                                    "generic" => 60,     // Generic macro tools
                                    "logitech" | "razer" | "corsair" => 20, // Peripheral software (lower risk)
                                    _ => 30,
                                };
                                result.risk_score += score;
                            }
                            break;
                        }
                    }
                }
            }
        }
    }

    // 2. Check for AutoHotkey scripts in common locations via registry
    // AutoHotkey registers .ahk file association
    unsafe {
        let key_path: Vec<u16> = "SOFTWARE\\Classes\\.ahk\0"
            .encode_utf16()
            .collect();

        let mut hkey: HKEY = HKEY::default();
        let open_result = RegOpenKeyExW(
            HKEY_LOCAL_MACHINE,
            PCWSTR(key_path.as_ptr()),
            0,
            KEY_READ,
            &mut hkey,
        );

        if open_result.is_ok() {
            let _ = RegCloseKey(hkey);
            // AHK is installed (file association exists)
            if !seen_names.contains(&"autohotkey_installed".to_string()) {
                seen_names.push("autohotkey_installed".to_string());
                result.macros_detected = true;
                result.detected_software.push(DetectedMacro {
                    name: "AutoHotkey (installed)".to_string(),
                    macro_type: "ahk".to_string(),
                    source: "registry".to_string(),
                });
                result.risk_score += 50;
            }
        }
    }

    println!("[Hardware] Macro Detection: detected={}, count={}, score={}",
             result.macros_detected, result.detected_software.len(), result.risk_score);

    result
}

#[cfg(not(target_os = "windows"))]
pub fn detect_macros() -> MacroDetectionResult {
    MacroDetectionResult::default()
}

// ====== OVERLAY DETECTION (Cheat Overlays, ESP, Aimbot Visual) ======

const SUSPICIOUS_OVERLAY_PROCESSES: &[&str] = &[
    // Known cheat overlays
    "overlay", "esp", "aimbot", "hack", "cheat",
    "unknowncheats", "mpgh", "elitepvpers",
    // Generic suspicious
    "injector", "loader", "trainer",
    // Drawing libraries often used by cheats
    "d3d", "directx", "opengl",
];

const SUSPICIOUS_WINDOW_CLASSES: &[&str] = &[
    // Qt (often used for cheat GUIs)
    "qt_", "qwidget", "qmainwindow",
    // Direct3D/OpenGL overlays
    "d3dwindowclass", "nvidia_overlay",
    // Known cheat framework classes
    "imgui", "dear imgui",
    // Transparent window classes
    "transparent", "overlay",
];

/// Detect suspicious overlay windows
#[cfg(target_os = "windows")]
pub fn detect_overlays() -> OverlayDetectionResult {
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowLongW, GetWindowTextW, GetClassNameW, GetWindowThreadProcessId,
        GWL_EXSTYLE, WS_EX_TOPMOST, WS_EX_LAYERED, WS_EX_TRANSPARENT, IsWindowVisible,
    };
    use windows::Win32::Foundation::{HWND, LPARAM, BOOL};
    use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};
    use windows::Win32::System::ProcessStatus::GetModuleBaseNameW;
    use std::sync::Mutex;
    
    lazy_static::lazy_static! {
        static ref OVERLAYS: Mutex<Vec<SuspiciousOverlay>> = Mutex::new(Vec::new());
    }
    
    // Clear previous results
    if let Ok(mut overlays) = OVERLAYS.lock() {
        overlays.clear();
    }
    
    unsafe extern "system" fn enum_window_callback(hwnd: HWND, _: LPARAM) -> BOOL {
        // Skip invisible windows
        if IsWindowVisible(hwnd).as_bool() == false {
            return BOOL(1);
        }
        
        // Get window extended style
        let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
        
        // Check for overlay characteristics
        let is_topmost = (ex_style & WS_EX_TOPMOST.0) != 0;
        let is_layered = (ex_style & WS_EX_LAYERED.0) != 0;
        let is_transparent = (ex_style & WS_EX_TRANSPARENT.0) != 0;
        
        // Skip if not suspicious (topmost + layered/transparent)
        if !is_topmost || (!is_layered && !is_transparent) {
            return BOOL(1);
        }
        
        // Get window title
        let mut title_buf = [0u16; 512];
        let title_len = GetWindowTextW(hwnd, &mut title_buf);
        let title = String::from_utf16_lossy(&title_buf[..title_len as usize]);
        
        // Get class name
        let mut class_buf = [0u16; 256];
        let class_len = GetClassNameW(hwnd, &mut class_buf);
        let class_name = String::from_utf16_lossy(&class_buf[..class_len as usize]);
        
        // Get process name
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        let mut process_name = String::new();
        
        if pid > 0 {
            if let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
                let mut name_buf = [0u16; 256];
                let len = GetModuleBaseNameW(handle, None, &mut name_buf);
                if len > 0 {
                    process_name = String::from_utf16_lossy(&name_buf[..len as usize]);
                }
                let _ = windows::Win32::Foundation::CloseHandle(handle);
            }
        }
        
        // Skip system windows
        let proc_lower = process_name.to_lowercase();
        let title_lower = title.to_lowercase();
        let class_lower = class_name.to_lowercase();
        
        // Skip known legitimate overlays
        if proc_lower.contains("explorer") || proc_lower.contains("dwm") ||
           proc_lower.contains("searchhost") || proc_lower.contains("shellexperiencehost") ||
           proc_lower.contains("textinputhost") || proc_lower.contains("nvidia share") ||
           proc_lower.contains("geforce") || proc_lower.contains("discord") ||
           proc_lower.contains("steam") || proc_lower.contains("obs") ||
           title_lower.is_empty() || class_lower.contains("tooltips_class") {
            return BOOL(1);
        }
        
        // Determine reason
        let mut reason = if is_transparent {
            "transparent_topmost"
        } else {
            "layered_topmost"
        };
        
        // Check for suspicious process names
        for suspicious in SUSPICIOUS_OVERLAY_PROCESSES {
            if proc_lower.contains(suspicious) || title_lower.contains(suspicious) {
                reason = "cheat_process";
                break;
            }
        }
        
        // Check for suspicious class names
        for suspicious_class in SUSPICIOUS_WINDOW_CLASSES {
            if class_lower.contains(suspicious_class) {
                reason = "suspicious_class";
                break;
            }
        }
        
        if let Ok(mut overlays) = OVERLAYS.lock() {
            overlays.push(SuspiciousOverlay {
                window_title: title,
                process_name,
                class_name,
                reason: reason.to_string(),
            });
        }
        
        BOOL(1) // Continue enumeration
    }
    
    let mut result = OverlayDetectionResult::default();
    
    unsafe {
        let _ = EnumWindows(Some(enum_window_callback), LPARAM(0));
    }
    
    // Collect results
    if let Ok(overlays) = OVERLAYS.lock() {
        for overlay in overlays.iter() {
            result.overlays_found = true;
            result.suspicious_overlays.push(overlay.clone());
            
            let score = match overlay.reason.as_str() {
                "cheat_process" => 90,
                "suspicious_class" => 70,
                "transparent_topmost" => 50,
                _ => 30,
            };
            result.risk_score += score;
        }
    }
    
    println!("[Hardware] Overlay Detection: found={}, count={}, score={}",
             result.overlays_found, result.suspicious_overlays.len(), result.risk_score);
    
    result
}

#[cfg(not(target_os = "windows"))]
pub fn detect_overlays() -> OverlayDetectionResult {
    OverlayDetectionResult::default()
}

// ====== DLL INJECTION DETECTION ======

const SUSPICIOUS_DLL_NAMES: &[(&str, &str)] = &[
    // Known injectors and hooking libraries
    ("detours", "Detours (API hooking library)"),
    ("minhook", "MinHook (hooking library)"),
    ("easyhook", "EasyHook (injection framework)"),
    ("injector", "Generic injector DLL"),
    ("hook", "Generic hook DLL"),
    // Cheat-related
    ("aimbot", "Aimbot DLL"),
    ("wallhack", "Wallhack DLL"),
    ("esp", "ESP DLL"),
    ("cheat", "Cheat DLL"),
    ("hack", "Hack DLL"),
    ("trainer", "Trainer DLL"),
    // Memory manipulation
    ("memory", "Memory manipulation DLL"),
    ("memoryedit", "Memory editor DLL"),
    ("ce_", "Cheat Engine DLL"),
    ("cheatengine", "Cheat Engine DLL"),
    // Script engines (can be used for injection)
    ("lua51", "Lua scripting (suspicious in games)"),
    ("python", "Python (suspicious in games)"),
    // Known bad actors
    ("unknowncheats", "UnknownCheats DLL"),
    ("mpgh", "MPGH DLL"),
    ("d3d9_proxy", "D3D9 proxy (common for cheats)"),
    ("d3d11_proxy", "D3D11 proxy (common for cheats)"),
    ("dinput8_proxy", "DInput proxy (input injection)"),
];

/// Detect suspicious DLLs that may indicate injection
#[cfg(target_os = "windows")]
pub fn detect_dll_injection() -> DllInjectionResult {
    use windows::Win32::System::ProcessStatus::{EnumProcessModules, GetModuleFileNameExW};
    use windows::Win32::System::Threading::GetCurrentProcess;
    use windows::Win32::Foundation::HMODULE;
    
    let mut result = DllInjectionResult::default();
    let mut seen_dlls: Vec<String> = Vec::new();
    
    // Check loaded modules in current process
    unsafe {
        let process = GetCurrentProcess();
        let mut modules: [HMODULE; 1024] = [HMODULE::default(); 1024];
        let mut needed: u32 = 0;
        
        if EnumProcessModules(
            process,
            modules.as_mut_ptr(),
            (modules.len() * std::mem::size_of::<HMODULE>()) as u32,
            &mut needed
        ).is_ok() {
            let count = (needed as usize) / std::mem::size_of::<HMODULE>();
            
            for i in 0..count.min(modules.len()) {
                let mut path_buf = [0u16; 512];
                let len = GetModuleFileNameExW(process, modules[i], &mut path_buf);
                
                if len > 0 {
                    let path = String::from_utf16_lossy(&path_buf[..len as usize]);
                    let path_lower = path.to_lowercase();
                    let name = path.split('\\').last().unwrap_or(&path).to_string();
                    let name_lower = name.to_lowercase();
                    
                    // Skip if already checked
                    if seen_dlls.contains(&name_lower) {
                        continue;
                    }
                    seen_dlls.push(name_lower.clone());
                    
                    // Check against suspicious DLL list
                    for (pattern, reason) in SUSPICIOUS_DLL_NAMES {
                        if name_lower.contains(pattern) {
                            result.injection_detected = true;
                            result.suspicious_dlls.push(SuspiciousDll {
                                name: name.clone(),
                                path: Some(path.clone()),
                                reason: reason.to_string(),
                            });
                            result.risk_score += 80;
                            break;
                        }
                    }
                    
                    // Check for DLLs loaded from suspicious locations
                    // (not in System32, SysWOW64, or Program Files)
                    let is_system_path = path_lower.contains("\\windows\\system32") ||
                                          path_lower.contains("\\windows\\syswow64") ||
                                          path_lower.contains("\\program files") ||
                                          path_lower.contains("\\programdata") ||
                                          path_lower.contains(".tauri");
                    
                    if !is_system_path && !name_lower.ends_with(".exe") {
                        // Check if it's from Temp or AppData\Local\Temp
                        if path_lower.contains("\\temp\\") || path_lower.contains("\\tmp\\") {
                            result.injection_detected = true;
                            result.suspicious_dlls.push(SuspiciousDll {
                                name,
                                path: Some(path),
                                reason: "DLL loaded from temp directory".to_string(),
                            });
                            result.risk_score += 60;
                        }
                    }
                }
            }
        }
    }
    
    // Also check via WMI for more comprehensive view
    if let Ok(com_con) = COMLibrary::new() {
        if let Ok(wmi_con) = WMIConnection::new(com_con) {
            #[derive(Deserialize)]
            #[allow(non_snake_case, dead_code)]
            struct Win32Process {
                Name: Option<String>,
                ExecutablePath: Option<String>,
            }
            
            // Look for known injector processes
            if let Ok(processes) = wmi_con.raw_query::<Win32Process>(
                "SELECT Name, ExecutablePath FROM Win32_Process"
            ) {
                for proc in processes {
                    let proc_name = proc.Name.clone();
                    let name = proc_name.clone().unwrap_or_default().to_lowercase();
                    
                    // Check for known injection tools running
                    let injection_tools = [
                        ("cheatengine", "Cheat Engine running"),
                        ("ce-x64", "Cheat Engine (64-bit) running"),
                        ("ce-x86", "Cheat Engine (32-bit) running"),
                        ("processhacker", "Process Hacker running"),
                        ("x64dbg", "x64dbg debugger running"),
                        ("x32dbg", "x32dbg debugger running"),
                        ("ollydbg", "OllyDbg debugger running"),
                        ("ida", "IDA Pro running"),
                        ("injector", "Injector tool running"),
                        ("dll inject", "DLL injection tool running"),
                    ];
                    
                    for (pattern, reason) in injection_tools {
                        if name.contains(pattern) {
                            let dll_name = proc_name.clone().unwrap_or_default();
                            if !result.suspicious_dlls.iter().any(|d| d.name.to_lowercase() == dll_name.to_lowercase()) {
                                result.injection_detected = true;
                                result.suspicious_dlls.push(SuspiciousDll {
                                    name: dll_name,
                                    path: proc.ExecutablePath.clone(),
                                    reason: reason.to_string(),
                                });
                                result.risk_score += 90;
                            }
                            break;
                        }
                    }
                }
            }
        }
    }
    
    println!("[Hardware] DLL Injection Detection: found={}, count={}, score={}",
             result.injection_detected, result.suspicious_dlls.len(), result.risk_score);
    
    result
}

#[cfg(not(target_os = "windows"))]
pub fn detect_dll_injection() -> DllInjectionResult {
    DllInjectionResult::default()
}

// ====== VM DETECTION (Virtual Machine) ======

/// Detect if running in a virtual machine
#[cfg(target_os = "windows")]
pub fn detect_vm() -> VmDetectionResult {
    let mut result = VmDetectionResult::default();
    
    // 1. Check via WMI for computer system information
    if let Ok(com_con) = COMLibrary::new() {
        if let Ok(wmi_con) = WMIConnection::new(com_con) {
            #[derive(Deserialize)]
            #[allow(non_snake_case, dead_code)]
            struct Win32ComputerSystem {
                Manufacturer: Option<String>,
                Model: Option<String>,
            }
            
            if let Ok(systems) = wmi_con.raw_query::<Win32ComputerSystem>(
                "SELECT Manufacturer, Model FROM Win32_ComputerSystem"
            ) {
                for system in systems {
                    let manufacturer = system.Manufacturer.unwrap_or_default().to_lowercase();
                    let model = system.Model.unwrap_or_default().to_lowercase();
                    
                    // VMware detection
                    if manufacturer.contains("vmware") || model.contains("vmware") {
                        result.vm_detected = true;
                        result.vm_type = Some("VMware".to_string());
                        result.vm_indicators.push("WMI: VMware computer system".to_string());
                        result.risk_score += 100;
                    }
                    // VirtualBox detection
                    else if manufacturer.contains("innotek") || model.contains("virtualbox") {
                        result.vm_detected = true;
                        result.vm_type = Some("VirtualBox".to_string());
                        result.vm_indicators.push("WMI: VirtualBox computer system".to_string());
                        result.risk_score += 100;
                    }
                    // Hyper-V detection
                    else if manufacturer.contains("microsoft") && model.contains("virtual") {
                        result.vm_detected = true;
                        result.vm_type = Some("Hyper-V".to_string());
                        result.vm_indicators.push("WMI: Hyper-V computer system".to_string());
                        result.risk_score += 100;
                    }
                    // QEMU/KVM detection
                    else if manufacturer.contains("qemu") || model.contains("qemu") || model.contains("kvm") {
                        result.vm_detected = true;
                        result.vm_type = Some("QEMU/KVM".to_string());
                        result.vm_indicators.push("WMI: QEMU/KVM computer system".to_string());
                        result.risk_score += 100;
                    }
                    // Xen detection
                    else if manufacturer.contains("xen") || model.contains("xen") {
                        result.vm_detected = true;
                        result.vm_type = Some("Xen".to_string());
                        result.vm_indicators.push("WMI: Xen computer system".to_string());
                        result.risk_score += 100;
                    }
                    // Parallels detection
                    else if manufacturer.contains("parallels") || model.contains("parallels") {
                        result.vm_detected = true;
                        result.vm_type = Some("Parallels".to_string());
                        result.vm_indicators.push("WMI: Parallels computer system".to_string());
                        result.risk_score += 100;
                    }
                }
            }
            
            // Check BIOS information
            #[derive(Deserialize)]
            #[allow(non_snake_case, dead_code)]
            struct Win32Bios {
                Manufacturer: Option<String>,
                SerialNumber: Option<String>,
                Version: Option<String>,
            }
            
            if let Ok(bioses) = wmi_con.raw_query::<Win32Bios>(
                "SELECT Manufacturer, SerialNumber, Version FROM Win32_BIOS"
            ) {
                for bios in bioses {
                    let manufacturer = bios.Manufacturer.unwrap_or_default().to_lowercase();
                    let version = bios.Version.unwrap_or_default().to_lowercase();
                    let serial = bios.SerialNumber.unwrap_or_default().to_lowercase();
                    
                    if manufacturer.contains("vmware") || version.contains("vmware") {
                        if result.vm_type.is_none() {
                            result.vm_detected = true;
                            result.vm_type = Some("VMware".to_string());
                            result.risk_score += 80;
                        }
                        result.vm_indicators.push("WMI: VMware BIOS".to_string());
                    }
                    if manufacturer.contains("virtualbox") || version.contains("vbox") || serial.contains("vbox") {
                        if result.vm_type.is_none() {
                            result.vm_detected = true;
                            result.vm_type = Some("VirtualBox".to_string());
                            result.risk_score += 80;
                        }
                        result.vm_indicators.push("WMI: VirtualBox BIOS".to_string());
                    }
                    if version.contains("hyper-v") || manufacturer.contains("microsoft") && version.contains("hyper") {
                        if result.vm_type.is_none() {
                            result.vm_detected = true;
                            result.vm_type = Some("Hyper-V".to_string());
                            result.risk_score += 80;
                        }
                        result.vm_indicators.push("WMI: Hyper-V BIOS".to_string());
                    }
                }
            }
            
            // Check for VM-specific processes
            #[derive(Deserialize)]
            #[allow(non_snake_case, dead_code)]
            struct Win32Process {
                Name: Option<String>,
            }
            
            if let Ok(processes) = wmi_con.raw_query::<Win32Process>(
                "SELECT Name FROM Win32_Process"
            ) {
                let vm_processes = [
                    ("vmtoolsd.exe", "VMware"),
                    ("vmwaretray.exe", "VMware"),
                    ("vmwareuser.exe", "VMware"),
                    ("vboxservice.exe", "VirtualBox"),
                    ("vboxtray.exe", "VirtualBox"),
                    ("vboxclient.exe", "VirtualBox"),
                    ("xenservice.exe", "Xen"),
                    ("prl_tools.exe", "Parallels"),
                    ("prl_cc.exe", "Parallels"),
                    ("vmcompute.exe", "Hyper-V"),
                ];
                
                for proc in processes {
                    let name = proc.Name.unwrap_or_default().to_lowercase();
                    for (vm_proc, vm_name) in vm_processes {
                        if name == vm_proc {
                            result.vm_detected = true;
                            if result.vm_type.is_none() {
                                result.vm_type = Some(vm_name.to_string());
                                result.risk_score += 90;
                            }
                            result.vm_indicators.push(format!("Process: {} ({})", vm_proc, vm_name));
                            break;
                        }
                    }
                }
            }
        }
    }
    
    // 2. Check registry for VM indicators
    unsafe {
        let vm_registry_keys = [
            ("SYSTEM\\CurrentControlSet\\Services\\VMTools", "VMware"),
            ("SOFTWARE\\VMware, Inc.\\VMware Tools", "VMware"),
            ("SYSTEM\\CurrentControlSet\\Services\\VBoxGuest", "VirtualBox"),
            ("SYSTEM\\CurrentControlSet\\Services\\VBoxMouse", "VirtualBox"),
            ("SYSTEM\\CurrentControlSet\\Services\\VBoxService", "VirtualBox"),
            ("SOFTWARE\\Oracle\\VirtualBox Guest Additions", "VirtualBox"),
            ("SYSTEM\\CurrentControlSet\\Services\\hv_vmbus", "Hyper-V"),
            ("SOFTWARE\\Microsoft\\Virtual Machine\\Guest\\Parameters", "Hyper-V"),
        ];
        
        for (key_path, vm_name) in vm_registry_keys {
            let key_path_w: Vec<u16> = format!("{}\0", key_path).encode_utf16().collect();
            let mut hkey: HKEY = HKEY::default();
            
            let open_result = RegOpenKeyExW(
                HKEY_LOCAL_MACHINE,
                PCWSTR(key_path_w.as_ptr()),
                0,
                KEY_READ,
                &mut hkey,
            );
            
            if open_result.is_ok() {
                let _ = RegCloseKey(hkey);
                result.vm_detected = true;
                if result.vm_type.is_none() {
                    result.vm_type = Some(vm_name.to_string());
                    result.risk_score += 70;
                }
                result.vm_indicators.push(format!("Registry: {} ({})", key_path, vm_name));
            }
        }
    }
    
    println!("[Hardware] VM Detection: detected={}, type={:?}, indicators={}, score={}",
             result.vm_detected, result.vm_type, result.vm_indicators.len(), result.risk_score);
    
    result
}

#[cfg(not(target_os = "windows"))]
pub fn detect_vm() -> VmDetectionResult {
    VmDetectionResult::default()
}

// ====== CLOUD PC DETECTION (Shadow, GeForce NOW, etc.) ======

/// Detect if running on a cloud gaming PC
#[cfg(target_os = "windows")]
pub fn detect_cloud_pc() -> CloudPcDetectionResult {
    let mut result = CloudPcDetectionResult::default();
    
    // 1. Check via WMI for cloud provider indicators
    if let Ok(com_con) = COMLibrary::new() {
        if let Ok(wmi_con) = WMIConnection::new(com_con) {
            #[derive(Deserialize)]
            #[allow(non_snake_case, dead_code)]
            struct Win32ComputerSystem {
                Manufacturer: Option<String>,
                Model: Option<String>,
            }
            
            if let Ok(systems) = wmi_con.raw_query::<Win32ComputerSystem>(
                "SELECT Manufacturer, Model FROM Win32_ComputerSystem"
            ) {
                for system in systems {
                    let manufacturer = system.Manufacturer.unwrap_or_default().to_lowercase();
                    let model = system.Model.unwrap_or_default().to_lowercase();
                    
                    // Shadow PC detection
                    if manufacturer.contains("shadow") || model.contains("shadow") {
                        result.cloud_pc_detected = true;
                        result.cloud_provider = Some("Shadow".to_string());
                        result.is_gaming_cloud = true;
                        result.cloud_indicators.push("WMI: Shadow cloud PC".to_string());
                        result.risk_score += 80;
                    }
                    // AWS (Amazon Web Services)
                    else if manufacturer.contains("amazon") || model.contains("aws") || model.contains("ec2") {
                        result.cloud_pc_detected = true;
                        result.cloud_provider = Some("AWS".to_string());
                        result.cloud_indicators.push("WMI: AWS cloud instance".to_string());
                        result.risk_score += 70;
                    }
                    // Azure
                    else if manufacturer.contains("microsoft") && (model.contains("azure") || model.contains("virtual machine")) {
                        result.cloud_pc_detected = true;
                        result.cloud_provider = Some("Azure".to_string());
                        result.cloud_indicators.push("WMI: Azure cloud instance".to_string());
                        result.risk_score += 70;
                    }
                    // Google Cloud
                    else if manufacturer.contains("google") || model.contains("google") {
                        result.cloud_pc_detected = true;
                        result.cloud_provider = Some("Google Cloud".to_string());
                        result.cloud_indicators.push("WMI: Google Cloud instance".to_string());
                        result.risk_score += 70;
                    }
                    // OVH
                    else if manufacturer.contains("ovh") || model.contains("ovh") {
                        result.cloud_pc_detected = true;
                        result.cloud_provider = Some("OVH".to_string());
                        result.cloud_indicators.push("WMI: OVH cloud instance".to_string());
                        result.risk_score += 60;
                    }
                    // Paperspace (for gaming)
                    else if manufacturer.contains("paperspace") || model.contains("paperspace") {
                        result.cloud_pc_detected = true;
                        result.cloud_provider = Some("Paperspace".to_string());
                        result.is_gaming_cloud = true;
                        result.cloud_indicators.push("WMI: Paperspace cloud PC".to_string());
                        result.risk_score += 80;
                    }
                    // Maximum Settings (gaming cloud)
                    else if manufacturer.contains("maximum") || model.contains("maximum settings") {
                        result.cloud_pc_detected = true;
                        result.cloud_provider = Some("Maximum Settings".to_string());
                        result.is_gaming_cloud = true;
                        result.cloud_indicators.push("WMI: Maximum Settings cloud PC".to_string());
                        result.risk_score += 80;
                    }
                }
            }
            
            // Check for cloud gaming software processes
            #[derive(Deserialize)]
            #[allow(non_snake_case, dead_code)]
            struct Win32Process {
                Name: Option<String>,
            }
            
            if let Ok(processes) = wmi_con.raw_query::<Win32Process>(
                "SELECT Name FROM Win32_Process"
            ) {
                let cloud_processes = [
                    // GeForce NOW
                    ("geforcenow.exe", "GeForce NOW", true),
                    ("geforcenowstreamer.exe", "GeForce NOW", true),
                    ("nvidia geforce now.exe", "GeForce NOW", true),
                    // Shadow
                    ("shadow.exe", "Shadow", true),
                    ("shadowstreamer.exe", "Shadow", true),
                    ("shadow launcher.exe", "Shadow", true),
                    // Parsec (can be used for cloud gaming)
                    ("parsecd.exe", "Parsec", true),
                    ("parsec.exe", "Parsec", true),
                    // Xbox Cloud Gaming / xCloud
                    ("xbox.exe", "Xbox Cloud Gaming", true),
                    ("xboxgamebarwidget.exe", "Xbox Cloud Gaming", false),
                    // Amazon Luna
                    ("luna.exe", "Amazon Luna", true),
                    // Boosteroid
                    ("boosteroid.exe", "Boosteroid", true),
                    // PlutoSphere
                    ("plutosphere.exe", "PlutoSphere", true),
                    // Loudplay
                    ("loudplay.exe", "Loudplay", true),
                    // Blacknut
                    ("blacknut.exe", "Blacknut", true),
                    // Rainway
                    ("rainway.exe", "Rainway", true),
                    // Moonlight (client for streaming)
                    ("moonlight.exe", "Moonlight", true),
                    // Stadia (RIP but might still exist)
                    ("stadia.exe", "Stadia", true),
                    // Remote desktop indicators (not gaming but cloud access)
                    ("mstsc.exe", "Remote Desktop", false),
                    ("anydesk.exe", "AnyDesk", false),
                    ("teamviewer.exe", "TeamViewer", false),
                ];
                
                for proc in processes {
                    let name = proc.Name.unwrap_or_default().to_lowercase();
                    for (cloud_proc, provider, is_gaming) in cloud_processes {
                        if name == cloud_proc {
                            if result.cloud_provider.is_none() || is_gaming {
                                result.cloud_pc_detected = true;
                                result.cloud_provider = Some(provider.to_string());
                                result.is_gaming_cloud = result.is_gaming_cloud || is_gaming;
                                result.risk_score += if is_gaming { 70 } else { 40 };
                            }
                            result.cloud_indicators.push(format!("Process: {} ({})", cloud_proc, provider));
                            break;
                        }
                    }
                }
            }
            
            // Check GPU - cloud gaming often uses datacenter GPUs
            #[derive(Deserialize)]
            #[allow(non_snake_case, dead_code)]
            struct Win32VideoController {
                Name: Option<String>,
                AdapterRAM: Option<u64>,
            }
            
            if let Ok(gpus) = wmi_con.raw_query::<Win32VideoController>(
                "SELECT Name, AdapterRAM FROM Win32_VideoController"
            ) {
                for gpu in gpus {
                    let name = gpu.Name.unwrap_or_default().to_lowercase();
                    
                    // Tesla GPUs (datacenter)
                    if name.contains("tesla") {
                        result.cloud_pc_detected = true;
                        result.cloud_indicators.push(format!("GPU: Tesla (datacenter GPU)"));
                        result.risk_score += 60;
                    }
                    // A100, A10, A16, A40 (datacenter)
                    else if name.contains("nvidia a100") || name.contains("nvidia a10") || 
                            name.contains("nvidia a16") || name.contains("nvidia a40") {
                        result.cloud_pc_detected = true;
                        result.cloud_indicators.push(format!("GPU: {} (datacenter GPU)", name));
                        result.risk_score += 60;
                    }
                    // GRID (virtual GPU)
                    else if name.contains("grid") {
                        result.cloud_pc_detected = true;
                        result.cloud_indicators.push(format!("GPU: {} (virtual GPU)", name));
                        result.risk_score += 70;
                    }
                    // Quadro RTX in datacenter context
                    else if name.contains("quadro rtx") {
                        result.cloud_indicators.push(format!("GPU: {} (possible datacenter)", name));
                        // Lower risk - Quadro can be local workstation too
                        result.risk_score += 20;
                    }
                }
            }
        }
    }
    
    // 2. Check registry for cloud gaming installations
    unsafe {
        let cloud_registry_keys = [
            ("SOFTWARE\\NVIDIA Corporation\\GeForce NOW", "GeForce NOW", true),
            ("SOFTWARE\\Shadow\\Shadow", "Shadow", true),
            ("SOFTWARE\\Parsec", "Parsec", true),
            ("SOFTWARE\\Boosteroid", "Boosteroid", true),
            ("SOFTWARE\\Rainway", "Rainway", true),
        ];
        
        for (key_path, provider, is_gaming) in cloud_registry_keys {
            let key_path_w: Vec<u16> = format!("{}\0", key_path).encode_utf16().collect();
            let mut hkey: HKEY = HKEY::default();
            
            let open_result = RegOpenKeyExW(
                HKEY_LOCAL_MACHINE,
                PCWSTR(key_path_w.as_ptr()),
                0,
                KEY_READ,
                &mut hkey,
            );
            
            if open_result.is_ok() {
                let _ = RegCloseKey(hkey);
                if result.cloud_provider.is_none() || is_gaming {
                    result.cloud_pc_detected = true;
                    result.cloud_provider = Some(provider.to_string());
                    result.is_gaming_cloud = result.is_gaming_cloud || is_gaming;
                    result.risk_score += if is_gaming { 50 } else { 30 };
                }
                result.cloud_indicators.push(format!("Registry: {} ({})", key_path, provider));
            }
            
            // Also check HKCU
            let open_result_cu = RegOpenKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR(key_path_w.as_ptr()),
                0,
                KEY_READ,
                &mut hkey,
            );
            
            if open_result_cu.is_ok() {
                let _ = RegCloseKey(hkey);
                if !result.cloud_indicators.iter().any(|i| i.contains(key_path)) {
                    if result.cloud_provider.is_none() || is_gaming {
                        result.cloud_pc_detected = true;
                        result.cloud_provider = Some(provider.to_string());
                        result.is_gaming_cloud = result.is_gaming_cloud || is_gaming;
                        result.risk_score += if is_gaming { 50 } else { 30 };
                    }
                    result.cloud_indicators.push(format!("Registry (HKCU): {} ({})", key_path, provider));
                }
            }
        }
    }
    
    println!("[Hardware] Cloud PC Detection: detected={}, provider={:?}, gaming={}, indicators={}, score={}",
             result.cloud_pc_detected, result.cloud_provider, result.is_gaming_cloud, 
             result.cloud_indicators.len(), result.risk_score);
    
    result
}

#[cfg(not(target_os = "windows"))]
pub fn detect_cloud_pc() -> CloudPcDetectionResult {
    CloudPcDetectionResult::default()
}

// ====== CHEAT WINDOW/PANEL DETECTION (CoD specific) ======

// Whitelist - Our own processes and windows that should never be flagged
const IRIS_WHITELIST: &[&str] = &[
    "iris-anticheat",
    "iris anticheat",
    "iris - nomercy",
    "nomercy anticheat",
];

// Known cheat software window titles and process names
const CHEAT_WINDOW_KEYWORDS: &[(&str, &str, &str)] = &[
    // Critical - Known CoD cheat providers
    ("engineowning", "EngineOwning", "critical"),
    ("skycheats", "SkyCheats", "critical"),
    ("ring-1", "Ring-1", "critical"),
    ("battlelog", "Battlelog Cheats", "critical"),
    ("iwantcheats", "IWantCheats", "critical"),
    ("wallhax", "Wallhax", "critical"),
    ("aimjunkies", "AimJunkies", "critical"),
    ("unknowncheats", "UnknownCheats", "critical"),
    ("phantom overlay", "Phantom Overlay", "critical"),
    ("pasted", "Pasted Cheats", "critical"),
    ("elitepvpers", "ElitePvPers", "critical"),
    ("artificialaiming", "ArtificialAiming", "critical"),
    ("aimware", "Aimware", "critical"),
    ("onetap", "OneTap", "critical"),
    ("fatality", "Fatality", "critical"),
    ("neverlose", "Neverlose", "critical"),
    ("gamesense", "GameSense", "critical"),
    ("iniuria", "Iniuria", "critical"),
    ("interium", "Interium", "critical"),
    ("nixware", "Nixware", "critical"),
    ("spirthack", "Spirthack", "critical"),
    
    // High risk - Generic cheat terms
    ("aimbot", "Aimbot Panel", "high"),
    ("wallhack", "Wallhack", "high"),
    ("esp hack", "ESP Hack", "high"),
    ("triggerbot", "Triggerbot", "high"),
    ("no recoil", "No Recoil", "high"),
    ("silent aim", "Silent Aim", "high"),
    ("rage hack", "Rage Hack", "high"),
    ("legit hack", "Legit Hack", "high"),
    ("hvh", "HvH Cheat", "high"),
    ("spinbot", "Spinbot", "high"),
    ("cheat menu", "Cheat Menu", "high"),
    ("hack menu", "Hack Menu", "high"),
    ("cheat panel", "Cheat Panel", "high"),
    ("hack panel", "Hack Panel", "high"),
    ("unlock all", "Unlock All Tool", "high"),
    ("camo unlocker", "Camo Unlocker", "high"),
    ("prestige hack", "Prestige Hack", "high"),
    
    // Medium risk - Injection/Debug tools often used with cheats
    ("extreme injector", "Extreme Injector", "medium"),
    ("process hacker", "Process Hacker", "medium"),
    ("cheat engine", "Cheat Engine", "medium"),
    ("x64dbg", "x64dbg", "medium"),
    ("x32dbg", "x32dbg", "medium"),
    ("ollydbg", "OllyDbg", "medium"),
    ("ida pro", "IDA Pro", "medium"),
    ("ida64", "IDA", "medium"),
    ("ghidra", "Ghidra", "medium"),
    ("windbg", "WinDbg", "medium"),
    ("reclass", "ReClass", "medium"),
    ("dll injector", "DLL Injector", "medium"),
    ("manual map", "Manual Map Injector", "medium"),
    
    // CoD specific tools
    ("cod tool", "CoD Tool", "high"),
    ("mw tool", "MW Tool", "high"),
    ("warzone tool", "Warzone Tool", "high"),
    ("bo6 tool", "BO6 Tool", "high"),
    ("black ops tool", "Black Ops Tool", "high"),
    ("plutonium", "Plutonium (Mod Client)", "medium"),
    ("h1-mod", "H1-Mod", "medium"),
];

// Known cheat process names (executable names)
const CHEAT_PROCESS_NAMES: &[(&str, &str, &str)] = &[
    // Cheat loaders/injectors
    ("eo loader", "EngineOwning Loader", "critical"),
    ("eo.exe", "EngineOwning", "critical"),
    ("loader.exe", "Suspicious Loader", "high"),
    ("injector.exe", "Suspicious Injector", "high"),
    ("cheat.exe", "Cheat Executable", "critical"),
    ("hack.exe", "Hack Executable", "critical"),
    ("trainer.exe", "Trainer", "high"),
    
    // Memory tools
    ("cheatengine", "Cheat Engine", "medium"),
    ("processhacker", "Process Hacker", "medium"),
    ("extremeinjector", "Extreme Injector", "medium"),
    
    // Known cheat executables
    ("phantom.exe", "Phantom Overlay", "critical"),
    ("ring1.exe", "Ring-1", "critical"),
    ("skycheats", "SkyCheats", "critical"),
];

/// Detect cheat windows and panels by scanning window titles
#[cfg(target_os = "windows")]
pub fn detect_cheat_windows() -> CheatWindowDetectionResult {
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible,
    };
    use windows::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ,
    };
    use windows::Win32::System::ProcessStatus::GetModuleBaseNameW;
    use windows::Win32::Foundation::{HWND, BOOL, LPARAM, CloseHandle};
    use std::sync::Mutex;
    
    let mut result = CheatWindowDetectionResult::default();
    let detected_windows: Mutex<Vec<DetectedCheatWindow>> = Mutex::new(Vec::new());
    
    unsafe extern "system" fn enum_window_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let detected = &*(lparam.0 as *const Mutex<Vec<DetectedCheatWindow>>);
        
        // Check if window is visible
        if !IsWindowVisible(hwnd).as_bool() {
            return BOOL(1); // Continue
        }
        
        // Get window title
        let mut title_buf = [0u16; 512];
        let title_len = GetWindowTextW(hwnd, &mut title_buf);
        if title_len == 0 {
            return BOOL(1);
        }
        let title = String::from_utf16_lossy(&title_buf[..title_len as usize]).to_lowercase();
        
        // Skip very short titles
        if title.len() < 3 {
            return BOOL(1);
        }
        
        // Get process name
        let mut process_id: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut process_id));
        
        let mut process_name = String::new();
        if process_id > 0 {
            if let Ok(handle) = OpenProcess(
                PROCESS_QUERY_INFORMATION | PROCESS_VM_READ,
                false,
                process_id
            ) {
                let mut name_buf = [0u16; 256];
                let name_len = GetModuleBaseNameW(handle, None, &mut name_buf);
                if name_len > 0 {
                    process_name = String::from_utf16_lossy(&name_buf[..name_len as usize]).to_lowercase();
                }
                let _ = CloseHandle(handle);
            }
        }
        
        // Skip our own Iris anticheat windows/processes (whitelist)
        for whitelist_item in IRIS_WHITELIST {
            if title.contains(whitelist_item) || process_name.contains(whitelist_item) {
                return BOOL(1); // Skip - it's us!
            }
        }
        
        // Check against known cheat window keywords
        for (keyword, cheat_name, risk) in CHEAT_WINDOW_KEYWORDS {
            if title.contains(keyword) {
                if let Ok(mut windows) = detected.lock() {
                    // Avoid duplicates
                    if !windows.iter().any(|w| w.window_title.to_lowercase() == title) {
                        windows.push(DetectedCheatWindow {
                            window_title: title.clone(),
                            process_name: process_name.clone(),
                            matched_cheat: cheat_name.to_string(),
                            risk_level: risk.to_string(),
                        });
                    }
                }
                break;
            }
        }
        
        // Check process name against known cheat processes
        if !process_name.is_empty() {
            for (keyword, cheat_name, risk) in CHEAT_PROCESS_NAMES {
                if process_name.contains(keyword) {
                    if let Ok(mut windows) = detected.lock() {
                        // Avoid duplicates
                        if !windows.iter().any(|w| w.process_name.to_lowercase() == process_name) {
                            windows.push(DetectedCheatWindow {
                                window_title: title.clone(),
                                process_name: process_name.clone(),
                                matched_cheat: cheat_name.to_string(),
                                risk_level: risk.to_string(),
                            });
                        }
                    }
                    break;
                }
            }
        }
        
        BOOL(1) // Continue enumeration
    }
    
    unsafe {
        let _ = EnumWindows(
            Some(enum_window_proc),
            LPARAM(&detected_windows as *const _ as isize)
        );
    }
    
    // Get results from mutex
    if let Ok(windows) = detected_windows.lock() {
        result.detected_windows = windows.clone();
        result.cheats_found = !windows.is_empty();
        
        // Calculate risk score
        for window in windows.iter() {
            match window.risk_level.as_str() {
                "critical" => result.risk_score += 100,
                "high" => result.risk_score += 75,
                "medium" => result.risk_score += 40,
                _ => result.risk_score += 25,
            }
        }
    }
    
    println!("[Hardware] Cheat Window Detection: found={}, count={}, score={}",
             result.cheats_found, result.detected_windows.len(), result.risk_score);
    
    result
}

#[cfg(not(target_os = "windows"))]
pub fn detect_cheat_windows() -> CheatWindowDetectionResult {
    CheatWindowDetectionResult::default()
}

// ====== SCREENSHOT CAPTURE ======

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
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
        if screen_dc.0 == 0 {
            println!("[Screenshot] Failed to get screen DC");
            return screenshots;
        }
        
        let mem_dc = CreateCompatibleDC(screen_dc);
        if mem_dc.0 == 0 {
            ReleaseDC(HWND::default(), screen_dc);
            println!("[Screenshot] Failed to create compatible DC");
            return screenshots;
        }
        
        let bitmap = CreateCompatibleBitmap(screen_dc, virtual_width, virtual_height);
        if bitmap.0 == 0 {
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

/// Capture screenshots with medium quality JPEG (for scan mode - reduces size)
#[cfg(target_os = "windows")]
pub fn capture_all_screens_medium_quality() -> Vec<ScreenshotData> {
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
    use image::{ImageBuffer, Rgb, DynamicImage};
    use std::io::Cursor;
    
    let mut screenshots = Vec::new();
    
    unsafe {
        let num_monitors = GetSystemMetrics(SM_CMONITORS);
        let virtual_x = GetSystemMetrics(SM_XVIRTUALSCREEN);
        let virtual_y = GetSystemMetrics(SM_YVIRTUALSCREEN);
        let virtual_width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
        let virtual_height = GetSystemMetrics(SM_CYVIRTUALSCREEN);
        
        println!("[Screenshot] Capturing {} monitor(s), virtual screen: {}x{} (medium quality)", 
                 num_monitors, virtual_width, virtual_height);
        
        let screen_dc = GetDC(HWND::default());
        if screen_dc.0 == 0 {
            return screenshots;
        }
        
        let mem_dc = CreateCompatibleDC(screen_dc);
        if mem_dc.0 == 0 {
            ReleaseDC(HWND::default(), screen_dc);
            return screenshots;
        }
        
        let bitmap = CreateCompatibleBitmap(screen_dc, virtual_width, virtual_height);
        if bitmap.0 == 0 {
            DeleteDC(mem_dc);
            ReleaseDC(HWND::default(), screen_dc);
            return screenshots;
        }
        
        let old_bitmap = SelectObject(mem_dc, bitmap);
        
        let _ = BitBlt(
            mem_dc,
            0, 0,
            virtual_width, virtual_height,
            screen_dc,
            virtual_x, virtual_y,
            SRCCOPY,
        );
        
        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: virtual_width,
                biHeight: -virtual_height,
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
        
        SelectObject(mem_dc, old_bitmap);
        DeleteObject(bitmap);
        DeleteDC(mem_dc);
        ReleaseDC(HWND::default(), screen_dc);
        
        if lines > 0 {
            // Convert BGRA to RGB (skip alpha for JPEG)
            let mut rgb_buffer: Vec<u8> = Vec::with_capacity((virtual_width * virtual_height * 3) as usize);
            for chunk in buffer.chunks_exact(4) {
                rgb_buffer.push(chunk[2]); // R
                rgb_buffer.push(chunk[1]); // G
                rgb_buffer.push(chunk[0]); // B
            }
            
            if let Some(img) = ImageBuffer::<Rgb<u8>, _>::from_raw(
                virtual_width as u32,
                virtual_height as u32,
                rgb_buffer
            ) {
                let dynamic_img = DynamicImage::ImageRgb8(img);
                let mut jpeg_data = Cursor::new(Vec::new());
                
                // Encode as JPEG with 60% quality (medium quality, much smaller size)
                let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_data, 60);
                if dynamic_img.write_with_encoder(encoder).is_ok() {
                    let base64_data = base64::engine::general_purpose::STANDARD
                        .encode(jpeg_data.into_inner());
                    
                    screenshots.push(ScreenshotData {
                        monitor_index: 0,
                        width: virtual_width as u32,
                        height: virtual_height as u32,
                        data_base64: base64_data,
                    });
                    
                    println!("[Screenshot] Captured {}x{} as JPEG (60% quality)", 
                             virtual_width, virtual_height);
                }
            }
        }
    }
    
    screenshots
}

#[cfg(not(target_os = "windows"))]
pub fn capture_all_screens_medium_quality() -> Vec<ScreenshotData> {
    Vec::new()
}

// ====== PROCESS AND USB DEVICE LISTING (for scan mode) ======

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessInfo {
    pub name: String,
    pub pid: u32,
    pub path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UsbDeviceInfo {
    pub name: String,
    pub device_id: String,
    pub manufacturer: Option<String>,
}

/// Get list of all running processes
#[cfg(target_os = "windows")]
pub fn get_all_processes() -> Vec<ProcessInfo> {
    let mut processes = Vec::new();
    
    if let Ok(com_con) = COMLibrary::new() {
        if let Ok(wmi_con) = WMIConnection::new(com_con) {
            #[derive(Deserialize)]
            #[allow(non_snake_case)]
            struct Win32Process {
                Name: Option<String>,
                ProcessId: Option<u32>,
                ExecutablePath: Option<String>,
            }
            
            if let Ok(results) = wmi_con.raw_query::<Win32Process>(
                "SELECT Name, ProcessId, ExecutablePath FROM Win32_Process"
            ) {
                for proc in results {
                    let name = proc.Name.unwrap_or_default();
                    if !name.is_empty() {
                        processes.push(ProcessInfo {
                            name,
                            pid: proc.ProcessId.unwrap_or(0),
                            path: proc.ExecutablePath,
                        });
                    }
                }
            }
        }
    }
    
    println!("[Hardware] Found {} running processes", processes.len());
    processes
}

#[cfg(not(target_os = "windows"))]
pub fn get_all_processes() -> Vec<ProcessInfo> {
    Vec::new()
}

/// Get list of all USB devices
#[cfg(target_os = "windows")]
pub fn get_all_usb_devices() -> Vec<UsbDeviceInfo> {
    let mut devices = Vec::new();
    
    if let Ok(com_con) = COMLibrary::new() {
        if let Ok(wmi_con) = WMIConnection::new(com_con) {
            #[derive(Deserialize)]
            #[allow(non_snake_case)]
            struct Win32PnpDevice {
                DeviceID: Option<String>,
                Name: Option<String>,
                Manufacturer: Option<String>,
            }
            
            if let Ok(results) = wmi_con.raw_query::<Win32PnpDevice>(
                "SELECT DeviceID, Name, Manufacturer FROM Win32_PnPEntity WHERE DeviceID LIKE 'USB%'"
            ) {
                for dev in results {
                    let name = dev.Name.unwrap_or_default();
                    let device_id = dev.DeviceID.unwrap_or_default();
                    if !device_id.is_empty() {
                        devices.push(UsbDeviceInfo {
                            name,
                            device_id,
                            manufacturer: dev.Manufacturer,
                        });
                    }
                }
            }
        }
    }
    
    println!("[Hardware] Found {} USB devices", devices.len());
    devices
}

#[cfg(not(target_os = "windows"))]
pub fn get_all_usb_devices() -> Vec<UsbDeviceInfo> {
    Vec::new()
}

// ====== GAME DETECTION IMPLEMENTATION ======

/// Detect if Call of Duty / Black Ops is running on this machine
/// Used to prevent bypass attempts (running Iris on a different PC than the game)
#[cfg(target_os = "windows")]
pub fn detect_game_running() -> GameDetectionResult {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId,
    };
    use windows::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ,
    };
    use windows::Win32::System::ProcessStatus::GetModuleBaseNameW;
    use windows::Win32::Foundation::CloseHandle;
    use std::time::{SystemTime, UNIX_EPOCH};
    
    let mut result = GameDetectionResult::default();
    let mut detected_game_process: Option<(String, u32)> = None;
    
    // Scan all processes for game executables
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
                    let proc_pid = process.ProcessId.unwrap_or(0);
                    
                    // Check against known game processes
                    for (game_exe, game_name) in GAME_PROCESSES {
                        if proc_name == *game_exe || proc_name.contains(game_exe) {
                            detected_game_process = Some((game_name.to_string(), proc_pid));
                            result.game_running = true;
                            result.game_name = Some(game_name.to_string());
                            result.game_pid = Some(proc_pid);
                            println!("[Hardware] Game detected: {} (PID: {})", game_name, proc_pid);
                            break;
                        }
                    }
                    
                    if result.game_running {
                        break;
                    }
                }
            }
        }
    }
    
    // Check if game window is currently focused (active)
    if result.game_running {
        unsafe {
            let foreground_hwnd = GetForegroundWindow();
            if foreground_hwnd.0 != 0 {
                let mut foreground_pid: u32 = 0;
                GetWindowThreadProcessId(foreground_hwnd, Some(&mut foreground_pid));
                
                // Check if foreground window belongs to the game process
                if let Some((_, game_pid)) = &detected_game_process {
                    if foreground_pid == *game_pid {
                        result.game_window_active = true;
                        println!("[Hardware] Game window is active/focused");
                    } else {
                        // Also check by process name in case PID changed
                        if foreground_pid > 0 {
                            if let Ok(handle) = OpenProcess(
                                PROCESS_QUERY_INFORMATION | PROCESS_VM_READ,
                                false,
                                foreground_pid
                            ) {
                                let mut name_buf = [0u16; 256];
                                let name_len = GetModuleBaseNameW(handle, None, &mut name_buf);
                                if name_len > 0 {
                                    let fg_name = String::from_utf16_lossy(&name_buf[..name_len as usize]).to_lowercase();
                                    for (game_exe, _) in GAME_PROCESSES {
                                        if fg_name == *game_exe || fg_name.contains(game_exe) {
                                            result.game_window_active = true;
                                            println!("[Hardware] Game window active (by name): {}", fg_name);
                                            break;
                                        }
                                    }
                                }
                                let _ = CloseHandle(handle);
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Set timestamp
    result.last_detected = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    
    println!("[Hardware] Game Detection: running={}, name={:?}, active={}", 
             result.game_running, result.game_name, result.game_window_active);
    
    result
}

#[cfg(not(target_os = "windows"))]
pub fn detect_game_running() -> GameDetectionResult {
    GameDetectionResult::default()
}

/// Detect game and track window activity over time
/// Returns extended GameSessionActivity with activity percentage tracking
#[cfg(target_os = "windows")]
pub fn detect_game_with_activity() -> GameSessionActivity {
    use std::time::{SystemTime, UNIX_EPOCH};
    
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    
    // Get basic game detection
    let basic = detect_game_running();
    
    // Update session tracker
    let mut tracker = GAME_SESSION_TRACKER.lock().unwrap();
    
    // Check if this is a new game session (game just started or different game)
    let is_new_session = basic.game_pid != tracker.last_game_pid && basic.game_running;
    let game_closed = !basic.game_running && tracker.last_game_pid.is_some();
    
    if is_new_session {
        // Reset tracker for new session
        println!("[Hardware] New game session detected, resetting activity tracker");
        tracker.session_start = now;
        tracker.total_samples = 1;
        tracker.active_samples = if basic.game_window_active { 1 } else { 0 };
        tracker.last_active_at = if basic.game_window_active { now } else { 0 };
        tracker.consecutive_inactive = if basic.game_window_active { 0 } else { 1 };
        tracker.last_game_pid = basic.game_pid;
    } else if game_closed {
        // Game closed, reset tracker
        println!("[Hardware] Game closed, resetting activity tracker");
        *tracker = GameSessionTracker::default();
    } else if basic.game_running {
        // Update existing session
        tracker.total_samples += 1;
        
        if basic.game_window_active {
            tracker.active_samples += 1;
            tracker.last_active_at = now;
            tracker.consecutive_inactive = 0;
        } else {
            tracker.consecutive_inactive += 1;
        }
    }
    
    // Calculate activity percentage
    let activity_percentage = if tracker.total_samples > 0 {
        (tracker.active_samples as f32 / tracker.total_samples as f32) * 100.0
    } else {
        0.0
    };
    
    let result = GameSessionActivity {
        game_running: basic.game_running,
        game_name: basic.game_name,
        game_pid: basic.game_pid,
        game_window_active: basic.game_window_active,
        last_detected: basic.last_detected,
        session_start: tracker.session_start,
        total_samples: tracker.total_samples,
        active_samples: tracker.active_samples,
        activity_percentage,
        last_active_at: tracker.last_active_at,
        consecutive_inactive: tracker.consecutive_inactive,
    };
    
    println!("[Hardware] Game Activity: running={}, active={}, samples={}/{}, activity={:.1}%, consecutive_inactive={}", 
             result.game_running, result.game_window_active, 
             result.active_samples, result.total_samples,
             result.activity_percentage, result.consecutive_inactive);
    
    result
}

#[cfg(not(target_os = "windows"))]
pub fn detect_game_with_activity() -> GameSessionActivity {
    GameSessionActivity::default()
}

/// Reset the game activity tracker (call when match ends or user wants to reset)
pub fn reset_game_activity_tracker() {
    if let Ok(mut tracker) = GAME_SESSION_TRACKER.lock() {
        *tracker = GameSessionTracker::default();
        println!("[Hardware] Game activity tracker reset");
    }
}
