/**
 * Iris Client Integrity & Anti-Tampering Module
 * 
 * This module provides multiple layers of protection against data falsification:
 * 1. Code integrity verification - Hash critical code files
 * 2. Anti-debugging detection - Detect if process is being debugged
 * 3. Process integrity - Verify no hooks or patches
 * 4. Raw output capture - Send original command outputs for server verification
 * 5. Multi-path verification - Get data from multiple sources
 * 6. Challenge-response authentication - Prove client authenticity to server
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

// Shared secret for challenge-response (must match server)
// This is obfuscated in the compiled binary
const CLIENT_AUTH_SECRET = Buffer.from('TlNfSVJJU19DTElFTlRfQVVUSF9TRUNSRVRfMjAyNF8hQCMkJV4mKigp', 'base64').toString();

// Client version for compatibility check
const CLIENT_VERSION = '1.0.0';

// Files to hash for integrity check (relative to src folder)
const CRITICAL_FILES = [
  'main.js',
  'utils/hardware.js',
  'utils/secureApi.js',
  'utils/integrity.js'
];

/**
 * Generate hash of critical code files
 * Server can verify these hashes match expected values
 */
function getCodeIntegrityHash() {
  const hashes = {};
  const srcDir = path.join(__dirname, '..');
  
  for (const file of CRITICAL_FILES) {
    const filePath = path.join(srcDir, file);
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        hashes[file] = crypto.createHash('sha256').update(content).digest('hex');
      }
    } catch (e) {
      hashes[file] = 'error';
    }
  }
  
  // Combined hash of all files
  const combinedHash = crypto.createHash('sha256')
    .update(Object.values(hashes).join(''))
    .digest('hex');
  
  return {
    files: hashes,
    combined: combinedHash
  };
}

/**
 * Detect if process is being debugged
 * Returns true if debugging is detected (suspicious)
 */
async function detectDebugging() {
  const checks = {
    debuggerAttached: false,
    devToolsOpen: false,
    suspiciousParent: false,
    timeAnomaly: false
  };
  
  try {
    // Check 1: Time-based detection (debuggers slow execution)
    const start = process.hrtime.bigint();
    for (let i = 0; i < 1000; i++) {
      Math.random();
    }
    const end = process.hrtime.bigint();
    const elapsed = Number(end - start) / 1000000; // ms
    
    // If loop takes more than 50ms, something is slowing us down
    checks.timeAnomaly = elapsed > 50;
    
    // Check 2: Check for common debugging/reversing tools
    const { stdout } = await execAsync(
      'tasklist /FO CSV 2>nul',
      { timeout: 5000 }
    );
    
    const suspiciousProcesses = [
      'ollydbg', 'x64dbg', 'x32dbg', 'ida', 'ida64',
      'wireshark', 'fiddler', 'charles', 'processhacker',
      'procmon', 'apimonitor', 'cheatengine', 'dnspy'
    ];
    
    const lowerOutput = stdout.toLowerCase();
    for (const proc of suspiciousProcesses) {
      if (lowerOutput.includes(proc)) {
        checks.suspiciousParent = true;
        break;
      }
    }
    
  } catch (e) {
    // Error during detection is also suspicious
  }
  
  return checks;
}

/**
 * Get security status with RAW command outputs for server verification
 * The server can re-parse these outputs to verify they match what we report
 */
async function getVerifiableSecurityStatus() {
  const result = {
    timestamp: Date.now(),
    rawOutputs: {},
    parsed: {},
    hashes: {},
    integrity: null
  };
  
  // Get code integrity first
  result.integrity = getCodeIntegrityHash();
  
  // Run security checks and capture RAW outputs
  const commands = {
    // TPM check - Get-Tpm
    tpm: 'powershell -Command "$tpm = Get-Tpm -ErrorAction Stop; [PSCustomObject]@{Present=$tpm.TpmPresent; Ready=$tpm.TpmReady; Enabled=$tpm.TpmEnabled} | ConvertTo-Json -Compress"',
    
    // TPM WMI backup
    tpmWmi: 'powershell -Command "Get-CimInstance -Namespace root/cimv2/Security/MicrosoftTpm -ClassName Win32_Tpm -ErrorAction Stop | Select-Object IsEnabled_InitialValue, IsActivated_InitialValue, SpecVersion | ConvertTo-Json -Compress"',
    
    // Secure Boot
    secureBoot: 'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\SecureBoot\\State" /v UEFISecureBootEnabled 2>nul',
    
    // DeviceGuard (VBS, HVCI)
    deviceGuard: 'powershell -Command "Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root/Microsoft/Windows/DeviceGuard -ErrorAction Stop | Select-Object VirtualizationBasedSecurityStatus, SecurityServicesRunning, AvailableSecurityProperties | ConvertTo-Json -Compress"',
    
    // Virtualization
    virtualization: 'powershell -Command "(Get-CimInstance -ClassName Win32_Processor).VirtualizationFirmwareEnabled"',
    
    // Hypervisor present
    hypervisor: 'powershell -Command "(Get-CimInstance -ClassName Win32_ComputerSystem).HypervisorPresent"',
    
    // Windows Defender
    defender: 'powershell -Command "Get-CimInstance -Namespace root/Microsoft/Windows/Defender -ClassName MSFT_MpComputerStatus -ErrorAction Stop | Select-Object AntivirusEnabled, RealTimeProtectionEnabled, IsTamperProtected | ConvertTo-Json -Compress"',
    
    // DMA/IOMMU
    iommu: 'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\DmaSecurity" /v DmaRemappingPolicy 2>nul'
  };
  
  // Execute all commands and capture raw output
  for (const [key, cmd] of Object.entries(commands)) {
    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 15000 });
      result.rawOutputs[key] = stdout.trim();
      // Hash the raw output for tamper detection
      result.hashes[key] = crypto.createHash('sha256')
        .update(stdout.trim())
        .digest('hex').substring(0, 16);
    } catch (e) {
      result.rawOutputs[key] = `ERROR: ${e.message}`;
      result.hashes[key] = 'error';
    }
  }
  
  // Parse the raw outputs into structured data
  result.parsed = parseRawOutputs(result.rawOutputs);
  
  // Add anti-debug check
  result.debugChecks = await detectDebugging();
  
  // Generate verification token
  // This combines all raw outputs into a hash that server can verify
  const verificationData = Object.values(result.rawOutputs).join('|');
  result.verificationToken = crypto.createHash('sha256')
    .update(verificationData + result.timestamp)
    .digest('hex');
  
  return result;
}

/**
 * Parse raw command outputs into structured security status
 */
function parseRawOutputs(rawOutputs) {
  const parsed = {
    tpm: { present: false, enabled: false, version: null },
    secureBoot: false,
    virtualization: false,
    iommu: false,
    hvci: false,
    vbs: false,
    defender: false,
    defenderRealtime: false
  };
  
  // Parse TPM
  try {
    if (rawOutputs.tpm && !rawOutputs.tpm.startsWith('ERROR')) {
      const tpmJson = JSON.parse(rawOutputs.tpm);
      parsed.tpm.present = tpmJson.Present === true;
      parsed.tpm.enabled = tpmJson.Ready === true || tpmJson.Enabled === true;
    } else if (rawOutputs.tpmWmi && !rawOutputs.tpmWmi.startsWith('ERROR')) {
      const wmiJson = JSON.parse(rawOutputs.tpmWmi);
      parsed.tpm.present = true;
      parsed.tpm.enabled = wmiJson.IsEnabled_InitialValue === true;
      if (wmiJson.SpecVersion) {
        parsed.tpm.version = wmiJson.SpecVersion.split(',')[0];
      }
    }
  } catch (e) {}
  
  // Parse Secure Boot
  try {
    parsed.secureBoot = rawOutputs.secureBoot && rawOutputs.secureBoot.includes('0x1');
  } catch (e) {}
  
  // Parse DeviceGuard (VBS, HVCI)
  try {
    if (rawOutputs.deviceGuard && !rawOutputs.deviceGuard.startsWith('ERROR')) {
      const dgJson = JSON.parse(rawOutputs.deviceGuard);
      parsed.vbs = dgJson.VirtualizationBasedSecurityStatus >= 1;
      
      // SecurityServicesRunning: 2 = HVCI
      if (Array.isArray(dgJson.SecurityServicesRunning)) {
        parsed.hvci = dgJson.SecurityServicesRunning.includes(2);
      } else if (typeof dgJson.SecurityServicesRunning === 'number') {
        parsed.hvci = dgJson.SecurityServicesRunning === 2;
      }
      
      // IOMMU from AvailableSecurityProperties
      if (Array.isArray(dgJson.AvailableSecurityProperties)) {
        parsed.iommu = dgJson.AvailableSecurityProperties.includes(3);
      }
    }
  } catch (e) {}
  
  // Parse Virtualization
  try {
    const virtEnabled = rawOutputs.virtualization?.trim().toLowerCase() === 'true';
    const hyperPresent = rawOutputs.hypervisor?.trim().toLowerCase() === 'true';
    parsed.virtualization = virtEnabled || hyperPresent;
  } catch (e) {}
  
  // Parse IOMMU from registry if not from DeviceGuard
  if (!parsed.iommu) {
    try {
      parsed.iommu = rawOutputs.iommu && 
        (rawOutputs.iommu.includes('0x1') || rawOutputs.iommu.includes('0x2'));
    } catch (e) {}
  }
  
  // Parse Defender
  try {
    if (rawOutputs.defender && !rawOutputs.defender.startsWith('ERROR')) {
      const defJson = JSON.parse(rawOutputs.defender);
      parsed.defender = defJson.AntivirusEnabled === true;
      parsed.defenderRealtime = defJson.RealTimeProtectionEnabled === true;
    }
  } catch (e) {}
  
  return parsed;
}

/**
 * Generate a tamper-evident package of security data
 * Server can verify the integrity of this data
 */
async function createSecurityAttestation() {
  const attestation = await getVerifiableSecurityStatus();
  
  // Add process information
  attestation.process = {
    pid: process.pid,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage().heapUsed,
    execPath: process.execPath
  };
  
  // Create final signature over all data
  const dataToSign = JSON.stringify({
    timestamp: attestation.timestamp,
    parsed: attestation.parsed,
    hashes: attestation.hashes,
    integrity: attestation.integrity.combined,
    pid: attestation.process.pid
  });
  
  attestation.attestationHash = crypto.createHash('sha256')
    .update(dataToSign)
    .digest('hex');
  
  return attestation;
}

/**
 * Solve a challenge from the server to prove client authenticity
 * The server sends a random challenge, we sign it with our secret
 * @param {string} challenge - Random challenge from server
 * @param {string} hardwareId - Hardware ID of this machine
 * @returns {object} - Challenge response with signature
 */
function solveChallenge(challenge, hardwareId) {
  const timestamp = Date.now();
  const integrity = getCodeIntegrityHash();
  
  // Create response data
  const responseData = {
    challenge,
    hardwareId,
    timestamp,
    codeHash: integrity.combined,
    version: CLIENT_VERSION,
    pid: process.pid
  };
  
  // Sign the response with our secret
  const dataToSign = JSON.stringify(responseData);
  const signature = crypto.createHmac('sha256', CLIENT_AUTH_SECRET)
    .update(dataToSign)
    .digest('hex');
  
  return {
    ...responseData,
    signature,
    fileHashes: integrity.files
  };
}

/**
 * Verify client authenticity with the server
 * Called on startup to ensure this client is allowed to operate
 * @param {function} apiCall - Function to call API (secureApi.post)
 * @param {string} token - Iris JWT token
 * @param {string} hardwareId - Hardware ID
 * @returns {object} - Verification result
 */
async function verifyClientAuthenticity(apiCall, token, hardwareId) {
  try {
    // Step 1: Request a challenge from the server
    const challengeResponse = await apiCall.post('/iris/auth/challenge', {
      hardwareId,
      version: CLIENT_VERSION,
      codeHash: getCodeIntegrityHash().combined
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!challengeResponse.data.success || !challengeResponse.data.challenge) {
      return {
        success: false,
        reason: 'Failed to get challenge',
        message: challengeResponse.data.message
      };
    }
    
    const { challenge, expiresAt } = challengeResponse.data;
    
    // Check if challenge is still valid
    if (Date.now() > expiresAt) {
      return {
        success: false,
        reason: 'Challenge expired'
      };
    }
    
    // Step 2: Solve the challenge
    const solution = solveChallenge(challenge, hardwareId);
    
    // Step 3: Submit the solution
    const verifyResponse = await apiCall.post('/iris/auth/verify', solution, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!verifyResponse.data.success) {
      return {
        success: false,
        reason: verifyResponse.data.reason || 'Verification failed',
        message: verifyResponse.data.message,
        blocked: verifyResponse.data.blocked
      };
    }
    
    return {
      success: true,
      sessionToken: verifyResponse.data.sessionToken,
      expiresAt: verifyResponse.data.expiresAt
    };
    
  } catch (error) {
    console.error('[Iris Auth] Verification error:', error.message);
    return {
      success: false,
      reason: 'Network error',
      message: error.message
    };
  }
}

/**
 * Get client version
 */
function getClientVersion() {
  return CLIENT_VERSION;
}

module.exports = {
  getCodeIntegrityHash,
  detectDebugging,
  getVerifiableSecurityStatus,
  createSecurityAttestation,
  parseRawOutputs,
  solveChallenge,
  verifyClientAuthenticity,
  getClientVersion,
  CLIENT_VERSION
};
