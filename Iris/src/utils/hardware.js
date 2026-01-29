const { machineIdSync } = require('node-machine-id');
const si = require('systeminformation');
const crypto = require('crypto');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

/**
 * Get TPM 2.0 Endorsement Key Hash if available
 * Falls back to other hardware identifiers if TPM is not present
 */
async function getTPMHash() {
  try {
    // Try to get TPM information using PowerShell
    const { stdout } = await execAsync(
      'powershell -Command "Get-Tpm | Select-Object -ExpandProperty TpmPresent; Get-TpmEndorsementKeyInfo -Algorithm Sha256 2>$null | Select-Object -ExpandProperty PublicKeyHash"',
      { timeout: 10000 }
    );
    
    const lines = stdout.trim().split('\n').filter(line => line.trim());
    
    if (lines.length >= 2 && lines[0].trim().toLowerCase() === 'true') {
      // TPM is present and we got a hash
      const tpmHash = lines[1]?.trim();
      if (tpmHash && tpmHash.length > 0) {
        return {
          type: 'tpm2',
          hash: tpmHash
        };
      }
    }
  } catch (error) {
    console.log('TPM not available, using fallback:', error.message);
  }
  
  return null;
}

/**
 * Get alternative hardware fingerprint when TPM is not available
 */
async function getAlternativeFingerprint() {
  const components = [];
  
  try {
    // Get CPU information
    const cpu = await si.cpu();
    components.push(`CPU:${cpu.manufacturer}:${cpu.brand}:${cpu.cores}`);
    
    // Get system UUID (from BIOS)
    const system = await si.system();
    if (system.uuid) {
      components.push(`UUID:${system.uuid}`);
    }
    
    // Get baseboard serial
    const baseboard = await si.baseboard();
    if (baseboard.serial) {
      components.push(`MB:${baseboard.manufacturer}:${baseboard.model}:${baseboard.serial}`);
    }
    
    // Get BIOS information
    const bios = await si.bios();
    if (bios.serial) {
      components.push(`BIOS:${bios.vendor}:${bios.serial}`);
    }
    
    // Get disk serials (first disk only)
    const disks = await si.diskLayout();
    if (disks.length > 0 && disks[0].serialNum) {
      components.push(`DISK:${disks[0].serialNum}`);
    }
    
    // Get machine ID as additional component
    const machineId = machineIdSync({ original: true });
    components.push(`MID:${machineId}`);
    
  } catch (error) {
    console.error('Error getting hardware info:', error);
  }
  
  // Create a deterministic hash from all components
  const fingerprint = components.join('|');
  const hash = crypto.createHash('sha256').update(fingerprint).digest('hex');
  
  return {
    type: 'hardware_fingerprint',
    hash: hash.toUpperCase()
  };
}

/**
 * Get unique hardware ID
 * Prioritizes TPM 2.0 if available, falls back to hardware fingerprint
 */
async function getHardwareId() {
  // Try TPM first
  const tpmResult = await getTPMHash();
  
  if (tpmResult) {
    console.log('Using TPM 2.0 for hardware ID');
    return tpmResult.hash;
  }
  
  // Fall back to hardware fingerprint
  console.log('Using hardware fingerprint for hardware ID');
  const fingerprint = await getAlternativeFingerprint();
  return fingerprint.hash;
}

/**
 * Get detailed system information for server-side validation
 */
async function getSystemInfo() {
  try {
    const [cpu, system, os, mem, graphics, baseboard] = await Promise.all([
      si.cpu(),
      si.system(),
      si.osInfo(),
      si.mem(),
      si.graphics(),
      si.baseboard()
    ]);
    
    return {
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores
      },
      system: {
        manufacturer: system.manufacturer,
        model: system.model,
        uuid: system.uuid
      },
      os: {
        platform: os.platform,
        distro: os.distro,
        release: os.release,
        arch: os.arch
      },
      memory: {
        total: Math.round(mem.total / (1024 * 1024 * 1024)) // GB
      },
      gpu: graphics.controllers.length > 0 ? {
        vendor: graphics.controllers[0].vendor,
        model: graphics.controllers[0].model,
        vram: graphics.controllers[0].vram
      } : null,
      baseboard: {
        manufacturer: baseboard.manufacturer,
        model: baseboard.model
      }
    };
  } catch (error) {
    console.error('Error getting system info:', error);
    return null;
  }
}

/**
 * Check if TPM 2.0 is available on this system
 */
async function checkTPMAvailability() {
  try {
    const { stdout } = await execAsync(
      'powershell -Command "(Get-Tpm).TpmPresent"',
      { timeout: 5000 }
    );
    return stdout.trim().toLowerCase() === 'true';
  } catch (error) {
    return false;
  }
}

/**
 * Get Windows Security Status at low level
 * Uses direct registry reads and WMI for more reliable/harder to spoof results
 */
async function getSecurityStatus() {
  const security = {
    secureBoot: { enabled: false, supported: false },
    tpm: { present: false, version: null, enabled: false, activated: false },
    defender: { enabled: false, realTimeProtection: false, tamperProtection: false },
    vbs: { enabled: false, running: false },
    hvci: { enabled: false, running: false },
    kernelDma: { enabled: false },
    uefi: { enabled: false },
    bitlocker: { enabled: false, protectionStatus: null }
  };

  try {
    // 1. Secure Boot - Read from registry (low level)
    try {
      const { stdout: secureBootOut } = await execAsync(
        'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\SecureBoot\\State" /v UEFISecureBootEnabled 2>nul',
        { timeout: 5000 }
      );
      security.secureBoot.supported = true;
      security.secureBoot.enabled = secureBootOut.includes('0x1');
    } catch (e) {
      // Try alternative method via firmware
      try {
        const { stdout } = await execAsync(
          'powershell -Command "[System.Text.Encoding]::ASCII.GetString((Get-SecureBootUEFI -Name SecureBoot -ErrorAction SilentlyContinue).Bytes) -ne $null"',
          { timeout: 5000 }
        );
        security.secureBoot.enabled = stdout.trim().toLowerCase() === 'true';
        security.secureBoot.supported = true;
      } catch (e2) {}
    }

    // 2. TPM - Direct WMI query (low level)
    try {
      const { stdout: tpmOut } = await execAsync(
        'wmic /namespace:\\\\root\\cimv2\\security\\microsofttpm path Win32_Tpm get IsActivated_InitialValue,IsEnabled_InitialValue,SpecVersion /format:list 2>nul',
        { timeout: 5000 }
      );
      
      security.tpm.present = tpmOut.length > 10;
      security.tpm.activated = tpmOut.includes('IsActivated_InitialValue=TRUE');
      security.tpm.enabled = tpmOut.includes('IsEnabled_InitialValue=TRUE');
      
      const versionMatch = tpmOut.match(/SpecVersion=([^\r\n]+)/);
      if (versionMatch) {
        security.tpm.version = versionMatch[1].trim().split(',')[0];
      }
    } catch (e) {}

    // 3. Windows Defender - Direct WMI (low level)
    try {
      const { stdout: defenderOut } = await execAsync(
        'wmic /namespace:\\\\root\\Microsoft\\Windows\\Defender path MSFT_MpComputerStatus get AMServiceEnabled,AntispywareEnabled,AntivirusEnabled,RealTimeProtectionEnabled,IsTamperProtected /format:list 2>nul',
        { timeout: 5000 }
      );
      
      security.defender.enabled = defenderOut.includes('AntivirusEnabled=TRUE');
      security.defender.realTimeProtection = defenderOut.includes('RealTimeProtectionEnabled=TRUE');
      security.defender.tamperProtection = defenderOut.includes('IsTamperProtected=TRUE');
    } catch (e) {}

    // 4. VBS (Virtualization-Based Security) - Registry
    try {
      const { stdout: vbsOut } = await execAsync(
        'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard" /v EnableVirtualizationBasedSecurity 2>nul',
        { timeout: 5000 }
      );
      security.vbs.enabled = vbsOut.includes('0x1');
      
      // Check if VBS is actually running
      const { stdout: vbsStatus } = await execAsync(
        'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard\\Scenarios\\HypervisorEnforcedCodeIntegrity" /v Enabled 2>nul',
        { timeout: 5000 }
      );
      security.vbs.running = vbsStatus.includes('0x1');
    } catch (e) {}

    // 5. HVCI (Memory Integrity) - Registry
    try {
      const { stdout: hvciOut } = await execAsync(
        'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard\\Scenarios\\HypervisorEnforcedCodeIntegrity" /v Enabled 2>nul',
        { timeout: 5000 }
      );
      security.hvci.enabled = hvciOut.includes('0x1');
      
      // Check running state via WMI
      const { stdout: hvciStatus } = await execAsync(
        'wmic /namespace:\\\\root\\Microsoft\\Windows\\DeviceGuard path Win32_DeviceGuard get VirtualizationBasedSecurityStatus /format:list 2>nul',
        { timeout: 5000 }
      );
      security.hvci.running = hvciStatus.includes('VirtualizationBasedSecurityStatus=2');
    } catch (e) {}

    // 6. Kernel DMA Protection - Registry
    try {
      const { stdout: dmaOut } = await execAsync(
        'reg query "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Kernel DMA Protection" /v DeviceEnumerationPolicy 2>nul',
        { timeout: 5000 }
      );
      security.kernelDma.enabled = dmaOut.includes('0x0') || dmaOut.includes('0x1');
    } catch (e) {
      // Alternative check
      try {
        const { stdout } = await execAsync(
          'wmic path Win32_ComputerSystem get BootupState /format:list 2>nul',
          { timeout: 5000 }
        );
        // If system boots normally, check IOMMU
        const { stdout: iommu } = await execAsync(
          'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\DmaSecurity" /v DmaRemappingPolicy 2>nul',
          { timeout: 5000 }
        );
        security.kernelDma.enabled = iommu.includes('0x1') || iommu.includes('0x2');
      } catch (e2) {}
    }

    // 7. UEFI Mode - Check firmware type
    try {
      const { stdout: uefiOut } = await execAsync(
        'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\SecureBoot\\State" 2>nul',
        { timeout: 5000 }
      );
      security.uefi.enabled = uefiOut.length > 0;
    } catch (e) {
      // Alternative: check EFI system partition
      try {
        const { stdout } = await execAsync(
          'bcdedit /enum firmware 2>nul',
          { timeout: 5000 }
        );
        security.uefi.enabled = stdout.includes('firmware');
      } catch (e2) {}
    }

    // 8. BitLocker - Direct WMI
    try {
      const { stdout: bitlockerOut } = await execAsync(
        'wmic /namespace:\\\\root\\cimv2\\Security\\MicrosoftVolumeEncryption path Win32_EncryptableVolume where "DriveLetter=\'C:\'" get ProtectionStatus /format:list 2>nul',
        { timeout: 5000 }
      );
      
      const statusMatch = bitlockerOut.match(/ProtectionStatus=(\d+)/);
      if (statusMatch) {
        const status = parseInt(statusMatch[1]);
        security.bitlocker.enabled = status === 1;
        security.bitlocker.protectionStatus = status === 1 ? 'on' : status === 0 ? 'off' : 'unknown';
      }
    } catch (e) {}

  } catch (error) {
    console.error('Error getting security status:', error);
  }

  return security;
}

module.exports = {
  getHardwareId,
  getSystemInfo,
  getTPMHash,
  checkTPMAvailability,
  getSecurityStatus
};
