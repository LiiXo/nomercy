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
  console.log('[Security] Checking TPM availability...');
  
  // Method 1: Direct Get-Tpm cmdlet (most reliable but requires admin)
  try {
    const { stdout } = await execAsync(
      'powershell -ExecutionPolicy Bypass -Command "$ErrorActionPreference=\'SilentlyContinue\'; $tpm = Get-Tpm; if($tpm) { $tpm.TpmPresent } else { $false }"',
      { timeout: 10000 }
    );
    const result = stdout.trim().toLowerCase();
    console.log('[Security] Get-Tpm result:', result);
    if (result === 'true') return true;
  } catch (e) {
    console.log('[Security] Get-Tpm failed:', e.message);
  }
  
  // Method 2: WMI namespace query (works without admin)
  try {
    const { stdout } = await execAsync(
      'powershell -ExecutionPolicy Bypass -Command "$ErrorActionPreference=\'SilentlyContinue\'; $tpm = Get-CimInstance -Namespace root/cimv2/Security/MicrosoftTpm -ClassName Win32_Tpm; if($tpm) { $true } else { $false }"',
      { timeout: 10000 }
    );
    const result = stdout.trim().toLowerCase();
    console.log('[Security] TPM WMI result:', result);
    if (result === 'true') return true;
  } catch (e) {
    console.log('[Security] TPM WMI failed:', e.message);
  }
  
  // Method 3: Check WMI object directly (alternative syntax)
  try {
    const { stdout } = await execAsync(
      'powershell -ExecutionPolicy Bypass -Command "$ErrorActionPreference=\'SilentlyContinue\'; (Get-WmiObject -Namespace root\\cimv2\\Security\\MicrosoftTpm -Class Win32_Tpm) -ne $null"',
      { timeout: 10000 }
    );
    const result = stdout.trim().toLowerCase();
    console.log('[Security] TPM WMI Object result:', result);
    if (result === 'true') return true;
  } catch (e) {
    console.log('[Security] TPM WMI Object failed:', e.message);
  }
  
  // Method 4: Check if TPM device exists in Device Manager (SecurityDevices)
  try {
    const { stdout } = await execAsync(
      'powershell -ExecutionPolicy Bypass -Command "$ErrorActionPreference=\'SilentlyContinue\'; (Get-PnpDevice -Class SecurityDevices | Where-Object { $_.FriendlyName -like \'*TPM*\' -or $_.FriendlyName -like \'*Trusted Platform*\' }).Count -gt 0"',
      { timeout: 10000 }
    );
    const result = stdout.trim().toLowerCase();
    console.log('[Security] TPM PnpDevice result:', result);
    if (result === 'true') return true;
  } catch (e) {
    console.log('[Security] TPM PnpDevice failed:', e.message);
  }
  
  // Method 5: Check registry for TPM service existence
  try {
    const { stdout } = await execAsync(
      'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Services\\TPM" /v Start 2>nul',
      { timeout: 5000 }
    );
    if (stdout.includes('REG_DWORD') || stdout.includes('0x')) {
      console.log('[Security] TPM service found in registry');
      return true; // TPM service exists, assume available
    }
  } catch (e) {
    console.log('[Security] TPM registry check failed:', e.message);
  }
  
  // Method 6: tpmtool check (Windows 10+)
  try {
    const { stdout } = await execAsync(
      'tpmtool getdeviceinformation 2>nul',
      { timeout: 5000 }
    );
    // If tpmtool returns anything (even errors about TPM state), it means TPM exists
    if (stdout && stdout.length > 10) {
      console.log('[Security] tpmtool detected TPM presence');
      return true;
    }
  } catch (e) {
    // tpmtool not found or TPM not present
    console.log('[Security] tpmtool failed:', e.message);
  }
  
  // Method 7: Final fallback - check for TPM2.0 in device path
  try {
    const { stdout } = await execAsync(
      'powershell -ExecutionPolicy Bypass -Command "$ErrorActionPreference=\'SilentlyContinue\'; (Get-PnpDevice | Where-Object { $_.InstanceId -like \'*TPM*\' -or $_.InstanceId -like \'*TBS*\' }).Count -gt 0"',
      { timeout: 10000 }
    );
    const result = stdout.trim().toLowerCase();
    console.log('[Security] TPM device path result:', result);
    if (result === 'true') return true;
  } catch (e) {
    console.log('[Security] TPM device path check failed:', e.message);
  }
  
  console.log('[Security] All TPM detection methods failed - TPM appears unavailable');
  return false;
}

/**
 * Get Windows Security Status at low level
 * Uses direct registry reads and WMI for more reliable/harder to spoof results
 */
async function getSecurityStatus() {
  const security = {
    secureBoot: { enabled: false, supported: false },
    tpm: { present: false, version: null, enabled: false, activated: false, publicKeyHash: null },
    defender: { enabled: false, realTimeProtection: false, tamperProtection: false },
    vbs: { enabled: false, running: false },
    hvci: { enabled: false, running: false },
    kernelDma: { enabled: false },
    uefi: { enabled: false },
    bitlocker: { enabled: false, protectionStatus: null },
    virtualization: { enabled: false, type: null, iommu: false },
    cpu: { manufacturer: null, isIntel: false, isAmd: false }
  };

  try {
    // 0. Get CPU info to determine virtualization naming
    try {
      const cpuInfo = await si.cpu();
      security.cpu.manufacturer = cpuInfo.manufacturer;
      security.cpu.isIntel = cpuInfo.manufacturer.toLowerCase().includes('intel');
      security.cpu.isAmd = cpuInfo.manufacturer.toLowerCase().includes('amd');
    } catch (e) {
      console.log('[Security] CPU info error:', e.message);
    }

    // 1. Secure Boot - Registry (lowest level)
    try {
      const { stdout: secureBootOut } = await execAsync(
        'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\SecureBoot\\State" /v UEFISecureBootEnabled 2>nul',
        { timeout: 5000 }
      );
      security.secureBoot.supported = true;
      security.secureBoot.enabled = secureBootOut.includes('0x1');
      console.log('[Security] Secure Boot:', security.secureBoot.enabled);
    } catch (e) {
      console.log('[Security] Secure Boot check error:', e.message);
    }

    // 2. TPM - Multiple detection methods for maximum reliability
    // Method 1: Direct Get-Tpm cmdlet (requires admin, most reliable)
    try {
      const { stdout: tpmCmd } = await execAsync(
        'powershell -Command "$tpm = Get-Tpm -ErrorAction Stop; [PSCustomObject]@{Present=$tpm.TpmPresent; Ready=$tpm.TpmReady; Enabled=$tpm.TpmEnabled} | ConvertTo-Json"',
        { timeout: 10000 }
      );
      
      console.log('[Security] Get-Tpm output:', tpmCmd);
      
      try {
        const tpmJson = JSON.parse(tpmCmd.trim());
        security.tpm.present = tpmJson.Present === true;
        security.tpm.enabled = tpmJson.Ready === true || tpmJson.Enabled === true;
        security.tpm.activated = security.tpm.enabled;
        console.log('[Security] TPM parsed:', tpmJson);
      } catch (parseErr) {
        // Fallback: parse as text
        security.tpm.present = tpmCmd.toLowerCase().includes('"present":') || tpmCmd.toLowerCase().includes('present');
        security.tpm.enabled = tpmCmd.toLowerCase().includes('true');
        security.tpm.activated = security.tpm.enabled;
      }
    } catch (e) {
      console.log('[Security] Get-Tpm failed, trying WMI:', e.message);
      
      // Method 2: WMI namespace query
      try {
        const { stdout: tpmWmi } = await execAsync(
          'powershell -Command "Get-CimInstance -Namespace root/cimv2/Security/MicrosoftTpm -ClassName Win32_Tpm -ErrorAction Stop | Select-Object -Property IsEnabled_InitialValue, IsActivated_InitialValue, SpecVersion | ConvertTo-Json"',
          { timeout: 10000 }
        );
        
        console.log('[Security] TPM WMI output:', tpmWmi);
        
        if (tpmWmi && tpmWmi.trim().length > 2) {
          security.tpm.present = true;
          try {
            const wmiJson = JSON.parse(tpmWmi.trim());
            security.tpm.enabled = wmiJson.IsEnabled_InitialValue === true;
            security.tpm.activated = wmiJson.IsActivated_InitialValue === true;
            if (wmiJson.SpecVersion) {
              security.tpm.version = wmiJson.SpecVersion.split(',')[0];
            }
          } catch (parseErr) {
            security.tpm.enabled = tpmWmi.includes('true') || tpmWmi.includes('True');
            security.tpm.activated = security.tpm.enabled;
          }
        }
      } catch (e2) {
        console.log('[Security] TPM WMI also failed:', e2.message);
        
        // Method 3: Registry check for TPM
        try {
          const { stdout: tpmReg } = await execAsync(
            'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Services\\TPM" /v Start 2>nul',
            { timeout: 5000 }
          );
          
          if (tpmReg.includes('0x') || tpmReg.includes('REG_DWORD')) {
            console.log('[Security] TPM service found in registry');
            security.tpm.present = true;
            
            // Check if TPM is actually working via tpmtool
            try {
              const { stdout: tpmTool } = await execAsync(
                'powershell -Command "tpmtool getdeviceinformation 2>$null | Select-String -Pattern \"TPM Present|TPM Has"',
                { timeout: 5000 }
              );
              if (tpmTool.toLowerCase().includes('true') || tpmTool.toLowerCase().includes('yes')) {
                security.tpm.enabled = true;
                security.tpm.activated = true;
              }
            } catch (e3) {}
          }
        } catch (e3) {
          console.log('[Security] TPM registry check failed:', e3.message);
        }
      }
    }
    
    // Get TPM version if not already set
    if (security.tpm.present && !security.tpm.version) {
      try {
        const { stdout: verOut } = await execAsync(
          'powershell -Command "(Get-CimInstance -Namespace root/cimv2/Security/MicrosoftTpm -ClassName Win32_Tpm).SpecVersion"',
          { timeout: 5000 }
        );
        if (verOut && verOut.trim()) {
          security.tpm.version = verOut.trim().split(',')[0];
        }
      } catch (e) {
        security.tpm.version = '2.0';
      }
    }

    // Get TPM Public Key Hash if TPM is present
    if (security.tpm.present) {
      try {
        const { stdout: keyHash } = await execAsync(
          'powershell -Command "(Get-TpmEndorsementKeyInfo -HashalgorithmName sha256 -ErrorAction SilentlyContinue).PublicKeyHash"',
          { timeout: 10000 }
        );
        if (keyHash && keyHash.trim().length > 0) {
          security.tpm.publicKeyHash = keyHash.trim();
          // If we got a key hash, TPM is definitely working
          security.tpm.enabled = true;
          security.tpm.activated = true;
        }
      } catch (e) {
        console.log('[Security] TPM key error:', e.message);
      }
    }
    
    console.log('[Security] Final TPM status:', security.tpm);

    // 3. Windows Defender - WMI
    try {
      const { stdout: defenderOut } = await execAsync(
        'powershell -Command "Get-CimInstance -Namespace root/Microsoft/Windows/Defender -ClassName MSFT_MpComputerStatus -ErrorAction Stop | Select-Object -Property AntivirusEnabled, RealTimeProtectionEnabled, IsTamperProtected | Format-List"',
        { timeout: 5000 }
      );
      
      security.defender.enabled = defenderOut.includes(': True') && defenderOut.toLowerCase().includes('antivirusenabled');
      security.defender.realTimeProtection = defenderOut.includes(': True') && defenderOut.toLowerCase().includes('realtimeprotectionenabled');
      security.defender.tamperProtection = defenderOut.includes(': True') && defenderOut.toLowerCase().includes('istamperprotected');
    } catch (e) {
      console.log('[Security] Defender check error:', e.message);
    }

    // 4. VBS & HVCI - Use DeviceGuard WMI (lowest level, direct from kernel)
    try {
      const { stdout: dgOut } = await execAsync(
        'powershell -Command "Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root/Microsoft/Windows/DeviceGuard -ErrorAction Stop | Select-Object -Property VirtualizationBasedSecurityStatus, SecurityServicesRunning, SecurityServicesConfigured, RequiredSecurityProperties, AvailableSecurityProperties | Format-List"',
        { timeout: 10000 }
      );
      
      console.log('[Security] DeviceGuard raw output:', dgOut);
      
      // VBS Status: 0=not enabled, 1=enabled but not running, 2=enabled and running
      const vbsMatch = dgOut.match(/VirtualizationBasedSecurityStatus\s*:\s*(\d+)/i);
      if (vbsMatch) {
        const vbsStatus = parseInt(vbsMatch[1]);
        security.vbs.enabled = vbsStatus >= 1;
        security.vbs.running = vbsStatus === 2;
      }
      
      // SecurityServicesRunning: {1} = Credential Guard, {2} = HVCI
      const servicesMatch = dgOut.match(/SecurityServicesRunning\s*:\s*\{?([^}\r\n]*)\}?/i);
      if (servicesMatch) {
        const services = servicesMatch[1];
        security.hvci.running = services.includes('2');
        security.hvci.enabled = security.hvci.running;
      }
      
      // RequiredSecurityProperties: 1=Hypervisor, 2=SecureBoot, 3=DMAProtection/IOMMU
      const reqPropsMatch = dgOut.match(/RequiredSecurityProperties\s*:\s*\{?([^}\r\n]*)\}?/i);
      if (reqPropsMatch) {
        const reqProps = reqPropsMatch[1];
        // If IOMMU is in required properties and VBS is running, IOMMU is active
        if (reqProps.includes('3') && security.vbs.running) {
          security.virtualization.iommu = true;
        }
      }
      
      // AvailableSecurityProperties tells us what hardware supports
      const availPropsMatch = dgOut.match(/AvailableSecurityProperties\s*:\s*\{?([^}\r\n]*)\}?/i);
      if (availPropsMatch) {
        const availProps = availPropsMatch[1];
        // 1=Hypervisor support, 2=SecureBoot, 3=DMAProtection available
        if (availProps.includes('3')) {
          security.virtualization.iommu = true;
        }
        if (availProps.includes('1')) {
          security.virtualization.enabled = true;
        }
      }
      
      console.log('[Security] VBS:', security.vbs, 'HVCI:', security.hvci);
    } catch (e) {
      console.log('[Security] DeviceGuard WMI error:', e.message);
    }

    // 5. Virtualization - Check via Hyper-V and processor directly
    if (!security.virtualization.enabled) {
      try {
        // Method 1: Check if Hyper-V hypervisor is present (means VT-x/AMD-V is working)
        const { stdout: hyperVOut } = await execAsync(
          'powershell -Command "(Get-CimInstance -ClassName Win32_ComputerSystem).HypervisorPresent"',
          { timeout: 5000 }
        );
        if (hyperVOut.trim().toLowerCase() === 'true') {
          security.virtualization.enabled = true;
        }
      } catch (e) {
        console.log('[Security] Hypervisor check error:', e.message);
      }
    }
    
    if (!security.virtualization.enabled) {
      try {
        // Method 2: Check processor VirtualizationFirmwareEnabled
        const { stdout: virtOut } = await execAsync(
          'powershell -Command "(Get-CimInstance -ClassName Win32_Processor).VirtualizationFirmwareEnabled"',
          { timeout: 5000 }
        );
        security.virtualization.enabled = virtOut.trim().toLowerCase() === 'true';
      } catch (e) {
        console.log('[Security] VT check error:', e.message);
      }
    }
    
    // Method 3: Check via systeminfo (most reliable but slower)
    if (!security.virtualization.enabled) {
      try {
        const { stdout: sysInfo } = await execAsync(
          'systeminfo',
          { timeout: 15000 }
        );
        // Look for Hyper-V requirements
        const hyperVSection = sysInfo.toLowerCase();
        if (hyperVSection.includes('virtualization enabled in firmware: yes') ||
            hyperVSection.includes('la virtualisation activée dans le microprogramme : oui') ||
            hyperVSection.includes('virtualisation activée dans le microprogramme: oui')) {
          security.virtualization.enabled = true;
        }
      } catch (e) {
        console.log('[Security] systeminfo error:', e.message);
      }
    }
    
    security.virtualization.type = security.cpu.isIntel ? 'VT-x' : security.cpu.isAmd ? 'AMD-V' : 'Unknown';
    console.log('[Security] Virtualization:', security.virtualization);

    // 6. IOMMU - Additional check via registry if not detected via DeviceGuard
    if (!security.virtualization.iommu) {
      try {
        const { stdout: dmaOut } = await execAsync(
          'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\DmaSecurity" /v DmaRemappingPolicy 2>nul',
          { timeout: 5000 }
        );
        security.virtualization.iommu = dmaOut.includes('0x1') || dmaOut.includes('0x2');
      } catch (e) {
        // Try alternative: check if DMA protection is running
        try {
          const { stdout: dgStatus } = await execAsync(
            'powershell -Command "(Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root/Microsoft/Windows/DeviceGuard).AvailableSecurityProperties -contains 3"',
            { timeout: 5000 }
          );
          if (dgStatus.trim().toLowerCase() === 'true') {
            security.virtualization.iommu = true;
          }
        } catch (e2) {}
      }
    }

    // 7. Kernel DMA Protection - Registry
    try {
      const { stdout: dmaOut } = await execAsync(
        'reg query "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Kernel DMA Protection" /v DeviceEnumerationPolicy 2>nul',
        { timeout: 5000 }
      );
      security.kernelDma.enabled = dmaOut.includes('0x0') || dmaOut.includes('0x1');
    } catch (e) {}

    // 8. UEFI Mode
    try {
      const { stdout: uefiOut } = await execAsync(
        'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\SecureBoot\\State" 2>nul',
        { timeout: 5000 }
      );
      security.uefi.enabled = uefiOut.length > 0;
    } catch (e) {}

    // 9. BitLocker - Direct WMI
    try {
      const { stdout: bitlockerOut } = await execAsync(
        'powershell -Command "(Get-CimInstance -Namespace root/cimv2/Security/MicrosoftVolumeEncryption -ClassName Win32_EncryptableVolume -Filter \"DriveLetter=\'C:\'\").ProtectionStatus"',
        { timeout: 5000 }
      );
      
      const status = parseInt(bitlockerOut.trim());
      if (!isNaN(status)) {
        security.bitlocker.enabled = status === 1;
        security.bitlocker.protectionStatus = status === 1 ? 'on' : 'off';
      }
    } catch (e) {
      console.log('[Security] BitLocker check error:', e.message);
    }

  } catch (error) {
    console.error('[Security] Global error:', error);
  }

  console.log('[Security] Final status:', JSON.stringify(security, null, 2));
  return security;
}

// Known cheat device signatures (names, VIDs, PIDs)
const CHEAT_DEVICES = [
  // ===== CRONUS FAMILY =====
  { name: 'cronus', vid: '2E4A', pid: null, brand: 'Cronus', severity: 'critical' },
  { name: 'cronusmax', vid: '2E4A', pid: null, brand: 'Cronus Max', severity: 'critical' },
  { name: 'cronusmax plus', vid: '2E4A', pid: '0001', brand: 'Cronus Max Plus', severity: 'critical' },
  { name: 'cronus zen', vid: '2E4A', pid: '0001', brand: 'Cronus Zen', severity: 'critical' },
  { name: 'cronus zen', vid: '2E4A', pid: '0002', brand: 'Cronus Zen', severity: 'critical' },
  { name: 'cronus zen', vid: '2E4A', pid: '0003', brand: 'Cronus Zen', severity: 'critical' },
  { name: 'collective minds', vid: '2E4A', pid: null, brand: 'Collective Minds Device', severity: 'critical' },
  
  // ===== XIM FAMILY =====
  { name: 'xim', vid: '0738', pid: null, brand: 'XIM', severity: 'critical' },
  { name: 'xim apex', vid: '0738', pid: '4553', brand: 'XIM Apex', severity: 'critical' },
  { name: 'xim4', vid: '0738', pid: '4540', brand: 'XIM 4', severity: 'critical' },
  { name: 'xim3', vid: '0738', pid: '4530', brand: 'XIM 3', severity: 'critical' },
  { name: 'xim nexus', vid: '0738', pid: '4573', brand: 'XIM Nexus', severity: 'critical' },
  { name: 'xim matrix', vid: '0738', pid: '4580', brand: 'XIM Matrix', severity: 'critical' },
  
  // ===== TITAN FAMILY =====
  { name: 'titan one', vid: '2341', pid: '8036', brand: 'Titan One', severity: 'critical' },
  { name: 'titan two', vid: '2341', pid: '8037', brand: 'Titan Two', severity: 'critical' },
  { name: 'consoletuner', vid: '2341', pid: null, brand: 'ConsoleTuner Device', severity: 'critical' },
  
  // ===== REASNOW =====
  { name: 'reasnow', vid: '1532', pid: null, brand: 'ReaSnow S1', severity: 'critical' },
  { name: 'reasnow s1', vid: '1532', pid: '0001', brand: 'ReaSnow S1', severity: 'critical' },
  { name: 'reasnow cross hair', vid: '1532', pid: '0002', brand: 'ReaSnow Cross Hair', severity: 'critical' },
  
  // ===== STRIKE PACK / DOMINATOR =====
  { name: 'strikepack', vid: '2E4A', pid: null, brand: 'Strike Pack', severity: 'critical' },
  { name: 'strike pack', vid: '2E4A', pid: null, brand: 'Strike Pack', severity: 'critical' },
  { name: 'fps strikepack', vid: '2E4A', pid: null, brand: 'FPS Strike Pack', severity: 'critical' },
  { name: 'dominator', vid: '2E4A', pid: null, brand: 'Dominator', severity: 'critical' },
  { name: 'battle beaver', vid: '2E4A', pid: null, brand: 'Battle Beaver', severity: 'high' },
  
  // ===== BELOADER =====
  { name: 'beloader', vid: 'BELO', pid: null, brand: 'BeLoader', severity: 'critical' },
  { name: 'beloader pro', vid: 'BELO', pid: null, brand: 'BeLoader Pro', severity: 'critical' },
  
  // ===== GIMX =====
  { name: 'gimx', vid: '1D6B', pid: null, brand: 'GIMX Adapter', severity: 'critical' },
  { name: 'gimx adapter', vid: '1D6B', pid: null, brand: 'GIMX Adapter', severity: 'critical' },
  
  // ===== KEYMANDER =====
  { name: 'keymander', vid: '0D8C', pid: null, brand: 'KeyMander', severity: 'critical' },
  { name: 'keymander 2', vid: '0D8C', pid: '0002', brand: 'KeyMander 2', severity: 'critical' },
  { name: 'keymander nexus', vid: '0D8C', pid: '0003', brand: 'KeyMander Nexus', severity: 'critical' },
  
  // ===== ADAPTER DEVICES (SUSPICIOUS) =====
  { name: 'brook', vid: '0C12', pid: null, brand: 'Brook Adapter', severity: 'high' },
  { name: 'brook wingman', vid: '0C12', pid: null, brand: 'Brook Wingman', severity: 'high' },
  { name: 'magic-ns', vid: '057E', pid: null, brand: 'Magic-NS Adapter', severity: 'medium' },
  { name: 'mayflash', vid: '0079', pid: null, brand: 'Mayflash Adapter', severity: 'medium' },
  { name: 'coov', vid: 'COOV', pid: null, brand: 'Coov Adapter', severity: 'high' },
  
  // ===== OTHER CONVERTERS =====
  { name: 'hori tac', vid: '0F0D', pid: null, brand: 'HORI TAC', severity: 'high' },
  { name: 'hori tactical', vid: '0F0D', pid: null, brand: 'HORI TAC Pro', severity: 'high' },
  { name: 'fragfx', vid: '1A34', pid: null, brand: 'FragFX', severity: 'high' },
  { name: 'venom-x', vid: 'VENX', pid: null, brand: 'Venom-X', severity: 'critical' },
  { name: 'iogear', vid: '0EA0', pid: null, brand: 'IOGEAR KeyMander', severity: 'critical' },
];

// Known cheat process names (software)
const CHEAT_PROCESSES = [
  // Cronus software
  'cronus', 'cronusmax', 'cronuszen', 'zen studio', 'cronus pro',
  // XIM software
  'xim', 'xim manager', 'xim apex', 'xim apex manager', 'xim4', 'xim nexus', 'xim matrix',
  // Titan software
  'titan one', 'titan two', 'gtuner', 'gtuner iv', 'gtuner pro', 'maximizer', 'titan studio',
  // ReaSnow
  'reasnow', 'reasnow studio',
  // DS4Windows and similar controller emulators
  'ds4windows', 'ds4window', 'ds4', 'ds4tool', 'ds4updater',
  'inputmapper', 'input mapper',
  'scp toolkit', 'scptoolkit', 'scpserver', 'scpmonitor',
  'betterjoyforcemu', 'betterjoy',
  'x360ce', 'x360', 'xinputplus',
  'vigembus', 'vigem', 'hidhide', 'hid hide',
  'dsuserver', 'ds4topc',
  // Other controller remapping software
  'rewasd', 'antimicro', 'antimicrox', 'xpadder', 'joytokey', 'joy2key',
  'controller companion', 'durazno', 'pinnacle game profiler', 'padstarr',
  'steam controller', 'sc-controller', 'sccontroller',
  // Strike Pack
  'strikepack', 'strikepack studio', 'dominator', 'mod pass', 'modpass',
  // Others
  'beloader', 'gimx', 'keymander', 'key mander', 'kmapp',
  // Scripting/Macro
  'autohotkey', 'ahk', 'macro recorder', 'macro toolworks', 'pulover', 'tinytask',
  'razer synapse macro', 'logitech macro', 'bloody mouse', 'a4tech bloody',
  // Mouse/Keyboard macro software
  'logitech g hub', 'ghub', 'lcore', 'razer synapse', 'synapse3', 'razercentral',
  'steelseries engine', 'steelseries gg', 'corsair icue', 'icue',
  'wooting', 'wooting software',
];

// Known gaming processes (to identify what games are running)
const GAMING_PROCESSES = [
  // Call of Duty
  { name: 'cod', display: 'Call of Duty', patterns: ['cod.exe', 'blackops', 'modernwarfare', 'callofduty', 'cod-cw', 'cod-bocw', 'bo6'] },
  { name: 'warzone', display: 'Warzone', patterns: ['warzone', 'wzm', 'wz2'] },
  { name: 'mw2', display: 'MW2/MW3', patterns: ['mw2', 'mw3', 'cod23', 's1x'] },
  // Other FPS
  { name: 'valorant', display: 'Valorant', patterns: ['valorant', 'valorant-win'] },
  { name: 'apex', display: 'Apex Legends', patterns: ['apex_legends', 'r5apex'] },
  { name: 'fortnite', display: 'Fortnite', patterns: ['fortnite', 'fortniteclient'] },
  { name: 'overwatch', display: 'Overwatch', patterns: ['overwatch', 'ow2'] },
  { name: 'csgo', display: 'CS2/CSGO', patterns: ['csgo', 'cs2'] },
  { name: 'rainbow6', display: 'Rainbow Six', patterns: ['rainbowsix', 'r6'] },
  // Battle.net / Launchers
  { name: 'battlenet', display: 'Battle.net', patterns: ['battle.net', 'blizzard'] },
  { name: 'steam', display: 'Steam', patterns: ['steam.exe', 'steamwebhelper'] },
  { name: 'epicgames', display: 'Epic Games', patterns: ['epicgameslauncher', 'easyanticheat'] },
];

// Suspicious USB categories
const SUSPICIOUS_USB_KEYWORDS = [
  'arduino', 'teensy', 'ch340', 'cp210', 'ft232', 'pl2303', // Microcontrollers often used for adapters
  'hid composite', 'usb composite', // Generic HID devices
  'stm32', 'atmel', 'atmega', // Microprocessors
];

/**
 * Get list of running processes
 */
async function getProcessList() {
  try {
    const { stdout } = await execAsync(
      'powershell -Command "Get-Process | Select-Object -Property ProcessName, Id, Path | ConvertTo-Json"',
      { timeout: 15000, maxBuffer: 1024 * 1024 * 10 }
    );
    
    const processes = JSON.parse(stdout);
    
    // Return simplified list with only name, id, and path
    return processes.map(p => ({
      name: p.ProcessName,
      pid: p.Id,
      path: p.Path || null
    })).filter(p => p.name); // Filter out empty entries
  } catch (error) {
    console.error('[Hardware] Get processes error:', error.message);
    return [];
  }
}

/**
 * Get list of USB devices
 */
async function getUsbDevices() {
  try {
    const { stdout } = await execAsync(
      'powershell -Command "Get-PnpDevice -Class USB -Status OK | Select-Object -Property FriendlyName, InstanceId, Manufacturer | ConvertTo-Json"',
      { timeout: 15000, maxBuffer: 1024 * 1024 * 5 }
    );
    
    const devices = JSON.parse(stdout);
    
    // Parse VID/PID from InstanceId
    return (Array.isArray(devices) ? devices : [devices]).filter(d => d).map(d => {
      const instanceId = d.InstanceId || '';
      const vidMatch = instanceId.match(/VID_([0-9A-F]{4})/i);
      const pidMatch = instanceId.match(/PID_([0-9A-F]{4})/i);
      
      return {
        name: d.FriendlyName || 'Unknown Device',
        manufacturer: d.Manufacturer || null,
        vid: vidMatch ? vidMatch[1].toUpperCase() : null,
        pid: pidMatch ? pidMatch[1].toUpperCase() : null,
        instanceId: instanceId
      };
    });
  } catch (error) {
    console.error('[Hardware] Get USB devices error:', error.message);
    return [];
  }
}

/**
 * Detect cheat devices (Cronus, XIM, etc.) with risk assessment
 * @param {Array} processes - List of running processes
 * @param {Array} usbDevices - List of USB devices
 * @returns {Object} Detection result with risk score
 */
function detectCheatDevices(processes = [], usbDevices = []) {
  const detected = {
    found: false,
    devices: [],
    processes: [],
    suspiciousUsb: [],
    gamesRunning: [],
    warnings: [],
    riskScore: 0,
    riskLevel: 'low' // low, medium, high, critical
  };
  
  // Check USB devices for cheat devices
  for (const device of usbDevices) {
    const deviceName = (device.name || '').toLowerCase();
    const deviceManu = (device.manufacturer || '').toLowerCase();
    
    for (const cheat of CHEAT_DEVICES) {
      let match = false;
      
      // Check by VID/PID
      if (cheat.vid && device.vid === cheat.vid) {
        if (!cheat.pid || device.pid === cheat.pid) {
          match = true;
        }
      }
      
      // Check by name
      if (cheat.name && (deviceName.includes(cheat.name) || deviceManu.includes(cheat.name))) {
        match = true;
      }
      
      if (match) {
        detected.found = true;
        detected.devices.push({
          type: cheat.brand,
          name: device.name,
          vid: device.vid,
          pid: device.pid,
          manufacturer: device.manufacturer,
          severity: cheat.severity || 'critical'
        });
        
        // Add risk score based on severity
        if (cheat.severity === 'critical') detected.riskScore += 100;
        else if (cheat.severity === 'high') detected.riskScore += 50;
        else if (cheat.severity === 'medium') detected.riskScore += 25;
        
        break;
      }
    }
    
    // Check for suspicious USB devices (microcontrollers, etc.)
    for (const keyword of SUSPICIOUS_USB_KEYWORDS) {
      if (deviceName.includes(keyword) || deviceManu.includes(keyword)) {
        detected.suspiciousUsb.push({
          name: device.name,
          manufacturer: device.manufacturer,
          vid: device.vid,
          pid: device.pid,
          reason: `Contient "${keyword}" (microcontrôleur/adaptateur potentiel)`
        });
        detected.riskScore += 15;
        break;
      }
    }
  }
  
  // Check running processes for cheat software
  for (const process of processes) {
    const processName = (process.name || '').toLowerCase();
    const processPath = (process.path || '').toLowerCase();
    
    // Check for cheat processes
    for (const cheatName of CHEAT_PROCESSES) {
      if (processName.includes(cheatName) || processPath.includes(cheatName)) {
        detected.found = true;
        detected.processes.push({
          name: process.name,
          pid: process.pid,
          path: process.path,
          matchedCheat: cheatName
        });
        detected.riskScore += 75;
        break;
      }
    }
    
    // Detect running games
    for (const game of GAMING_PROCESSES) {
      for (const pattern of game.patterns) {
        if (processName.includes(pattern) || processPath.includes(pattern)) {
          if (!detected.gamesRunning.find(g => g.name === game.name)) {
            detected.gamesRunning.push({
              name: game.name,
              display: game.display,
              processName: process.name
            });
          }
          break;
        }
      }
    }
  }
  
  // Calculate final risk level
  if (detected.riskScore >= 100) {
    detected.riskLevel = 'critical';
  } else if (detected.riskScore >= 50) {
    detected.riskLevel = 'high';
  } else if (detected.riskScore >= 25) {
    detected.riskLevel = 'medium';
  } else {
    detected.riskLevel = 'low';
  }
  
  // Generate warnings
  if (detected.devices.length > 0) {
    const criticalDevices = detected.devices.filter(d => d.severity === 'critical');
    const highDevices = detected.devices.filter(d => d.severity === 'high');
    
    if (criticalDevices.length > 0) {
      detected.warnings.push(`🚨 CRITIQUE: ${criticalDevices.length} périphérique(s) de triche détecté(s): ${criticalDevices.map(d => d.type).join(', ')}`);
    }
    if (highDevices.length > 0) {
      detected.warnings.push(`⚠️ SUSPECT: ${highDevices.length} adaptateur(s) suspect(s): ${highDevices.map(d => d.type).join(', ')}`);
    }
  }
  
  if (detected.processes.length > 0) {
    detected.warnings.push(`💻 ${detected.processes.length} logiciel(s) de triche/macro détecté(s): ${detected.processes.map(p => p.name).join(', ')}`);
  }
  
  if (detected.suspiciousUsb.length > 0) {
    detected.warnings.push(`🔌 ${detected.suspiciousUsb.length} périphérique(s) USB suspect(s) (microcontrôleurs)`);
  }
  
  if (detected.gamesRunning.length > 0) {
    detected.warnings.push(`🎮 Jeu(x) en cours: ${detected.gamesRunning.map(g => g.display).join(', ')}`);
  }
  
  // Set found flag if any suspicious activity
  if (detected.suspiciousUsb.length > 0 && detected.riskScore >= 25) {
    detected.found = true;
  }
  
  return detected;
}

module.exports = {
  getHardwareId,
  getSystemInfo,
  getTPMHash,
  checkTPMAvailability,
  getSecurityStatus,
  getProcessList,
  getUsbDevices,
  detectCheatDevices,
  CHEAT_DEVICES,
  CHEAT_PROCESSES,
  GAMING_PROCESSES,
  SUSPICIOUS_USB_KEYWORDS
};
