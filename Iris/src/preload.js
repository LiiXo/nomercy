const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('iris', {
  // Authentication
  startDiscordAuth: () => ipcRenderer.invoke('start-discord-auth'),
  getStoredUser: () => ipcRenderer.invoke('get-stored-user'),
  verifySession: () => ipcRenderer.invoke('verify-session'),
  logout: () => ipcRenderer.invoke('logout'),
  
  // Client authenticity verification
  verifyClient: () => ipcRenderer.invoke('verify-client'),
  isClientVerified: () => ipcRenderer.invoke('is-client-verified'),
  
  // Auto-update
  getVersion: () => ipcRenderer.invoke('get-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  // Hardware
  getHardwareId: () => ipcRenderer.invoke('get-hardware-id'),
  getSecurityStatus: () => ipcRenderer.invoke('get-security-status'),
  
  // Heartbeat
  startHeartbeat: () => ipcRenderer.send('start-heartbeat'),
  
  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  close: () => ipcRenderer.invoke('window-close'),
  
  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Event listeners
  onAuthStatus: (callback) => {
    ipcRenderer.on('auth-status', (event, data) => callback(data));
  },
  onAuthSuccess: (callback) => {
    ipcRenderer.on('auth-success', (event, data) => callback(data));
  },
  onAuthError: (callback) => {
    ipcRenderer.on('auth-error', (event, data) => callback(data));
  },
  onHeartbeatStatus: (callback) => {
    ipcRenderer.on('heartbeat-status', (event, data) => callback(data));
  },
  onSecurityAlert: (callback) => {
    ipcRenderer.on('security-alert', (event, data) => callback(data));
  },
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, data) => callback(data));
  },
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-progress', (event, data) => callback(data));
  }
});
