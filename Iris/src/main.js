const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { getHardwareId, getSystemInfo, getSecurityStatus, getProcessList, getUsbDevices, detectCheatDevices, checkTPMAvailability } = require('./utils/hardware');
const { createSecureClient } = require('./utils/secureApi');
const { 
  createSecurityAttestation, 
  getCodeIntegrityHash, 
  verifyClientAuthenticity, 
  CLIENT_VERSION 
} = require('./utils/integrity');
const { performUpdateCheck, getCurrentVersion } = require('./utils/updater');

// Configuration
const store = new Store();
const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
const API_URL = isDev 
  ? 'http://localhost:5000/api' 
  : 'https://nomercy.ggsecure.io/api';
const SITE_URL = isDev
  ? 'http://localhost:5173'
  : 'https://nomercy.ggsecure.io';

// Create secure API client with HMAC signing
const secureApi = createSecureClient(API_URL, isDev);

console.log('[Iris] Mode:', isDev ? 'DEVELOPMENT' : 'PRODUCTION');
console.log('[Iris] API URL:', API_URL);
console.log('[Iris] Client Version:', CLIENT_VERSION);

let mainWindow;

// Client verification session
let clientSessionToken = null;
let clientSessionExpiry = null;

// Register custom protocol for OAuth callback (iris://callback?code=xxx)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('iris', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('iris');
}

// Handle protocol URL on Windows (single instance)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    // Handle the protocol URL from second instance
    const url = commandLine.find(arg => arg.startsWith('iris://'));
    if (url) {
      handleProtocolUrl(url);
    }
    
    // Focus main window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Handle custom protocol URL
function handleProtocolUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.pathname === '//callback' || parsedUrl.host === 'callback') {
      // Check for token (direct from NoMercy API)
      const token = parsedUrl.searchParams.get('token');
      if (token) {
        handleTokenCallback(token);
        return;
      }
    }
  } catch (error) {
    console.error('Failed to parse protocol URL:', error);
  }
}

// Handle token received from NoMercy API
async function handleTokenCallback(token) {
  mainWindow.webContents.send('auth-status', { status: 'processing' });
  
  try {
    // Check TPM availability FIRST before any authentication
    console.log('[Iris Auth] Checking TPM availability...');
    const tpmAvailable = await checkTPMAvailability();
    
    if (!tpmAvailable) {
      console.log('[Iris Auth] TPM is not available or disabled!');
      mainWindow.webContents.send('auth-error', { 
        message: 'TPM 2.0 est désactivé ou non disponible sur votre système.\n\nVeuillez activer le TPM dans les paramètres BIOS/UEFI de votre PC pour utiliser Iris.',
        type: 'tpm_disabled',
        title: 'TPM Requis'
      });
      return;
    }
    
    console.log('[Iris Auth] TPM is available, proceeding with authentication...');
    
    // Verify token and get user info from NoMercy API
    const response = await secureApi.get('/iris/verify', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (response.data.success) {
      const user = response.data.user;
      
      // Get hardware ID
      const hardwareId = await getHardwareId();
      const systemInfo = await getSystemInfo();
      
      // Register hardware with NoMercy API
      const registerResponse = await secureApi.post('/iris/register-hardware', {
        hardwareId: hardwareId,
        systemInfo: systemInfo
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (registerResponse.data.success) {
        // Save auth data locally
        store.set('user', {
          id: user._id,
          discordId: user.discordId,
          username: user.username,
          avatarUrl: user.avatarUrl,
          hardwareId: hardwareId
        });
        store.set('token', token);
        
        mainWindow.webContents.send('auth-success', {
          user: user,
          hardwareId: hardwareId
        });
      } else {
        mainWindow.webContents.send('auth-error', { 
          message: registerResponse.data.message || 'Hardware registration failed' 
        });
      }
    } else {
      mainWindow.webContents.send('auth-error', { 
        message: response.data.message || 'Token verification failed' 
      });
    }
  } catch (error) {
    console.error('Auth error:', error);
    mainWindow.webContents.send('auth-error', { 
      message: error.response?.data?.message || 'Authentication failed' 
    });
  }
}

// Create main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 780,
    minWidth: 450,
    minHeight: 700,
    resizable: true,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0b',
    icon: path.join(__dirname, '../assets/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

// Discord OAuth config
const DISCORD_CLIENT_ID = '1447607594351853618';
const DISCORD_REDIRECT_URI = isDev
  ? 'http://localhost:5000/api/iris/discord-callback'
  : 'https://nomercy.ggsecure.io/api/iris/discord-callback';

console.log('[Iris] Discord Redirect URI:', DISCORD_REDIRECT_URI);

// Open Discord OAuth in browser
function createAuthWindow() {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify email'
  });
  
  const discordAuthUrl = `https://discord.com/oauth2/authorize?${params.toString()}`;
  
  // Open Discord OAuth page in default browser
  shell.openExternal(discordAuthUrl);
  
  // Show waiting state
  mainWindow.webContents.send('auth-status', { 
    status: 'waiting', 
    message: 'En attente de l\'autorisation Discord...' 
  });
}

// App ready
app.whenReady().then(async () => {
  createWindow();
  
  // Check for updates on startup (after window is created)
  setTimeout(async () => {
    console.log('[Iris] Checking for updates on startup...');
    try {
      const updateResult = await performUpdateCheck(secureApi, mainWindow, (status) => {
        console.log('[Iris Update]', status);
        if (mainWindow) {
          mainWindow.webContents.send('update-status', status);
        }
      });
      
      if (updateResult.needsUpdate && updateResult.installing) {
        console.log('[Iris] Update installing, app will restart...');
        return; // Don't continue, app will quit
      }
      
      if (updateResult.needsUpdate && updateResult.mandatory) {
        console.log('[Iris] Mandatory update required but not installed, quitting...');
        return; // App will quit
      }
    } catch (err) {
      console.error('[Iris] Update check failed:', err.message);
      // Continue anyway - don't block app if update check fails
    }
  }, 1500); // Wait for window to be ready

  // Handle protocol URL if app was started with one (Windows)
  const protocolUrl = process.argv.find(arg => arg.startsWith('iris://'));
  if (protocolUrl) {
    setTimeout(() => handleProtocolUrl(protocolUrl), 500);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  
  // Handle protocol on macOS
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleProtocolUrl(url);
  });
});

// Quit when all windows closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

// Start authentication (opens NoMercy authorization page)
ipcMain.handle('start-discord-auth', async () => {
  try {
    createAuthWindow();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get stored user data
ipcMain.handle('get-stored-user', async () => {
  const user = store.get('user');
  const token = store.get('token');
  
  if (user && token) {
    return { success: true, user, token };
  }
  return { success: false };
});

// Get hardware ID
ipcMain.handle('get-hardware-id', async () => {
  try {
    const hardwareId = await getHardwareId();
    return { success: true, hardwareId };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get security status (Windows security modules state)
ipcMain.handle('get-security-status', async () => {
  try {
    const security = await getSecurityStatus();
    return { success: true, security };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Logout
ipcMain.handle('logout', async () => {
  store.delete('user');
  store.delete('token');
  return { success: true };
});

// Window controls
ipcMain.handle('window-minimize', () => {
  mainWindow.minimize();
});

ipcMain.handle('window-close', () => {
  app.quit();
});

// Verify session with server
ipcMain.handle('verify-session', async () => {
  const token = store.get('token');
  const user = store.get('user');
  
  if (!token || !user) {
    return { success: false, reason: 'no_session' };
  }
  
  try {
    // Check TPM availability first
    const tpmAvailable = await checkTPMAvailability();
    
    if (!tpmAvailable) {
      console.log('[Iris] TPM not available, refusing session verification');
      // Clear session since TPM is required
      store.delete('user');
      store.delete('token');
      return { 
        success: false, 
        reason: 'tpm_disabled',
        message: 'TPM 2.0 est désactivé ou non disponible sur votre système.\n\nVeuillez activer le TPM dans les paramètres BIOS/UEFI de votre PC pour utiliser Iris.'
      };
    }
    
    const hardwareId = await getHardwareId();
    
    // Check if hardware ID matches stored one
    if (user.hardwareId && hardwareId !== user.hardwareId) {
      console.log('[Iris] Hardware ID mismatch, clearing session');
      store.delete('user');
      store.delete('token');
      return { success: false, reason: 'hardware_mismatch' };
    }
    
    // Verify token with server using GET endpoint
    const response = await secureApi.get('/iris/verify', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (response.data.success) {
      console.log('[Iris] Session verified for:', response.data.user.username);
      // Update stored user with latest data
      const updatedUser = {
        ...user,
        ...response.data.user,
        hardwareId: hardwareId
      };
      store.set('user', updatedUser);
      return { success: true, user: updatedUser };
    } else {
      console.log('[Iris] Session verification failed:', response.data.message);
      store.delete('user');
      store.delete('token');
      return { success: false, reason: response.data.message || 'invalid_session' };
    }
  } catch (error) {
    console.error('[Iris] Session verification error:', error.message);
    // Don't clear session on network error - allow offline use
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.log('[Iris] Server unreachable, using cached session');
      return { success: true, user };
    }
    // Clear session on auth errors
    if (error.response?.status === 401 || error.response?.status === 403) {
      store.delete('user');
      store.delete('token');
      return { success: false, reason: 'invalid_token' };
    }
    return { success: false, reason: 'server_error' };
  }
});

// Open external link
ipcMain.handle('open-external', async (event, url) => {
  shell.openExternal(url);
});

// ====== CLIENT AUTHENTICITY VERIFICATION ======
// Verify that this client is authentic and unmodified before allowing operations

async function performClientVerification() {
  const token = store.get('token');
  const user = store.get('user');
  
  if (!token || !user) {
    console.log('[Iris Auth] No session, cannot verify client');
    return { success: false, reason: 'no_session' };
  }
  
  // Check if we already have a valid session
  if (clientSessionToken && clientSessionExpiry && Date.now() < clientSessionExpiry) {
    console.log('[Iris Auth] Using existing verified session');
    return { success: true, sessionToken: clientSessionToken };
  }
  
  try {
    console.log('[Iris Auth] Starting client verification...');
    const hardwareId = await getHardwareId();
    
    const result = await verifyClientAuthenticity(secureApi, token, hardwareId);
    
    if (result.success) {
      console.log('[Iris Auth] Client verified successfully!');
      clientSessionToken = result.sessionToken;
      clientSessionExpiry = result.expiresAt;
      return { success: true, sessionToken: result.sessionToken };
    } else {
      console.warn('[Iris Auth] Verification failed:', result.reason);
      
      // If blocked, notify user
      if (result.blocked && mainWindow) {
        mainWindow.webContents.send('security-alert', {
          type: 'client_blocked',
          message: 'Le client Iris n\'est pas authentique. Veuillez télécharger la version officielle.',
          reason: result.reason
        });
      }
      
      return result;
    }
  } catch (error) {
    console.error('[Iris Auth] Verification error:', error.message);
    return { success: false, reason: 'error', message: error.message };
  }
}

// IPC handler for client verification
ipcMain.handle('verify-client', async () => {
  return await performClientVerification();
});

// Check if client is currently verified
ipcMain.handle('is-client-verified', async () => {
  if (clientSessionToken && clientSessionExpiry && Date.now() < clientSessionExpiry) {
    return { verified: true, expiresAt: clientSessionExpiry };
  }
  return { verified: false };
});

// ====== AUTO-UPDATE HANDLERS ======

// Get current version
ipcMain.handle('get-version', async () => {
  return { 
    version: getCurrentVersion(),
    clientVersion: CLIENT_VERSION
  };
});

// Manual update check
ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await performUpdateCheck(secureApi, mainWindow, (status) => {
      if (mainWindow) {
        mainWindow.webContents.send('update-status', status);
      }
    });
    return result;
  } catch (error) {
    return { error: error.message };
  }
});

// ====== HEARTBEAT SYSTEM ======
// Send security status to server every 5 minutes
// Includes integrity verification to prevent data falsification
let heartbeatInterval = null;
const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes

async function sendHeartbeat() {
  const token = store.get('token');
  const user = store.get('user');
  
  if (!token || !user) {
    console.log('[Iris Heartbeat] No session, skipping heartbeat');
    return;
  }
  
  try {
    // Verify client authenticity before sending heartbeat
    // This ensures only authentic clients can send security status
    if (!clientSessionToken || !clientSessionExpiry || Date.now() >= clientSessionExpiry) {
      console.log('[Iris Heartbeat] Session expired, re-verifying client...');
      const verifyResult = await performClientVerification();
      if (!verifyResult.success) {
        console.warn('[Iris Heartbeat] Client verification failed, cannot send heartbeat');
        if (mainWindow) {
          mainWindow.webContents.send('security-alert', {
            type: 'verification_failed',
            message: 'Impossible de vérifier l\'authenticité du client.',
            reason: verifyResult.reason
          });
        }
        return;
      }
    }
    
    console.log('[Iris Heartbeat] Creating security attestation...');
    
    // Get verifiable security attestation with raw outputs
    // This prevents falsification by sending raw command outputs
    // that the server can independently verify
    const attestation = await createSecurityAttestation();
    const hardwareId = await getHardwareId();
    
    // Get processes, USB devices, and detect cheat devices
    console.log('[Iris Heartbeat] Collecting process and device information...');
    const processes = await getProcessList();
    const usbDevices = await getUsbDevices();
    const cheatDetection = detectCheatDevices(processes, usbDevices);
    
    if (cheatDetection.found) {
      console.warn('[Iris Heartbeat] CHEAT DEVICE/SOFTWARE DETECTED!', cheatDetection.warnings);
    }
    
    // Check for suspicious activity
    if (attestation.debugChecks.suspiciousParent || attestation.debugChecks.debuggerAttached) {
      console.warn('[Iris Heartbeat] Suspicious activity detected!');
    }
    
    // Send verifiable data to server with session token
    const response = await secureApi.post('/iris/heartbeat', {
      hardwareId,
      // Parsed security values (for quick access)
      security: {
        tpm: attestation.parsed.tpm,
        secureBoot: attestation.parsed.secureBoot,
        virtualization: attestation.parsed.virtualization,
        iommu: attestation.parsed.iommu,
        hvci: attestation.parsed.hvci,
        vbs: attestation.parsed.vbs,
        defender: attestation.parsed.defender,
        defenderRealtime: attestation.parsed.defenderRealtime
      },
      // Process and device information
      systemInfo: {
        processes: processes.slice(0, 200), // Limit to 200 processes to avoid payload size issues
        usbDevices: usbDevices,
        cheatDetection: cheatDetection
      },
      // Raw command outputs for server-side verification
      // Server can re-parse these to verify they match parsed values
      verification: {
        rawOutputs: attestation.rawOutputs,
        outputHashes: attestation.hashes,
        timestamp: attestation.timestamp,
        verificationToken: attestation.verificationToken
      },
      // Client integrity data
      integrity: {
        codeHash: attestation.integrity.combined,
        fileHashes: attestation.integrity.files,
        attestationHash: attestation.attestationHash
      },
      // Anti-tampering checks
      antiTamper: {
        debugChecks: attestation.debugChecks,
        processInfo: attestation.process
      },
      // Client session for authentication
      clientSession: clientSessionToken
    }, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'X-Iris-Session': clientSessionToken
      }
    });
    
    if (response.data.success) {
      console.log('[Iris Heartbeat] Attestation sent successfully');
      // Notify renderer
      if (mainWindow) {
        mainWindow.webContents.send('heartbeat-status', { 
          success: true, 
          timestamp: Date.now(),
          verified: response.data.verified 
        });
      }
    } else {
      console.log('[Iris Heartbeat] Heartbeat failed:', response.data.message);
      // If server detected tampering, notify user
      if (response.data.tamperDetected && mainWindow) {
        mainWindow.webContents.send('security-alert', {
          type: 'tampering',
          message: response.data.message
        });
      }
    }
  } catch (error) {
    console.error('[Iris Heartbeat] Error sending heartbeat:', error.message);
    // Don't stop heartbeat on error, will retry on next interval
  }
}

async function startHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  
  // Verify client authenticity before starting heartbeat
  console.log('[Iris Heartbeat] Verifying client before starting...');
  const verifyResult = await performClientVerification();
  if (!verifyResult.success) {
    console.warn('[Iris Heartbeat] Client verification failed, cannot start heartbeat');
    if (mainWindow) {
      mainWindow.webContents.send('security-alert', {
        type: 'verification_failed',
        message: 'Impossible de vérifier l\'authenticité du client.',
        reason: verifyResult.reason,
        blocked: verifyResult.blocked
      });
    }
    return;
  }
  console.log('[Iris Heartbeat] Client verified, starting heartbeat...');
  
  // Send first heartbeat immediately
  sendHeartbeat();
  
  // Then every 5 minutes
  heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
  console.log('[Iris Heartbeat] Started (interval: 5 minutes)');
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    console.log('[Iris Heartbeat] Stopped');
  }
}

// Start heartbeat when user is authenticated
ipcMain.on('start-heartbeat', async () => {
  await startHeartbeat();
});

// Stop heartbeat on logout
const originalLogout = ipcMain.listeners('handle:logout');
ipcMain.removeHandler('logout');
ipcMain.handle('logout', async () => {
  stopHeartbeat();
  // Clear client session
  clientSessionToken = null;
  clientSessionExpiry = null;
  store.delete('user');
  store.delete('token');
  return { success: true };
});

// Auto-start heartbeat after successful auth
const originalAuthSuccess = mainWindow?.webContents;
// We'll trigger heartbeat from renderer side after successful auth
