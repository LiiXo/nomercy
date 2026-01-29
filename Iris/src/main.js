const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { getHardwareId, getSystemInfo, getSecurityStatus } = require('./utils/hardware');
const axios = require('axios');

// Configuration
const store = new Store();
const API_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:5000/api' 
  : 'https://nomercy.ggsecure.io/api';
const SITE_URL = process.env.NODE_ENV === 'development'
  ? 'http://localhost:5173'
  : 'https://nomercy.ggsecure.io';

let mainWindow;

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
    // Verify token and get user info from NoMercy API
    const response = await axios.get(`${API_URL}/iris/verify`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (response.data.success) {
      const user = response.data.user;
      
      // Get hardware ID
      const hardwareId = await getHardwareId();
      const systemInfo = await getSystemInfo();
      
      // Register hardware with NoMercy API
      const registerResponse = await axios.post(`${API_URL}/iris/register-hardware`, {
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
    width: 450,
    height: 650,
    minWidth: 400,
    minHeight: 600,
    resizable: false,
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
const DISCORD_REDIRECT_URI = process.env.NODE_ENV === 'development'
  ? 'http://localhost:5173/iris/callback'
  : 'https://nomercy.ggsecure.io/iris/callback';

// Open Discord OAuth directly (opens Discord app if installed)
function createAuthWindow() {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify'
  });
  
  const discordAuthUrl = `https://discord.com/oauth2/authorize?${params.toString()}`;
  shell.openExternal(discordAuthUrl);
  
  // Show processing state
  mainWindow.webContents.send('auth-status', { status: 'waiting', message: 'Waiting for Discord authorization...' });
}

// App ready
app.whenReady().then(() => {
  createWindow();

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
    const hardwareId = await getHardwareId();
    
    // Check if hardware ID matches
    if (hardwareId !== user.hardwareId) {
      store.delete('user');
      store.delete('token');
      return { success: false, reason: 'hardware_mismatch' };
    }
    
    // Verify with server
    const response = await axios.post(`${API_URL}/iris/verify`, {
      token,
      hardwareId
    });
    
    if (response.data.success) {
      return { success: true, user };
    } else {
      store.delete('user');
      store.delete('token');
      return { success: false, reason: response.data.reason || 'invalid_session' };
    }
  } catch (error) {
    return { success: false, reason: 'server_error' };
  }
});

// Open external link
ipcMain.handle('open-external', async (event, url) => {
  shell.openExternal(url);
});
