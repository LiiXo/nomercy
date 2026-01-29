const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('iris', {
  // Authentication
  startDiscordAuth: () => ipcRenderer.invoke('start-discord-auth'),
  getStoredUser: () => ipcRenderer.invoke('get-stored-user'),
  verifySession: () => ipcRenderer.invoke('verify-session'),
  logout: () => ipcRenderer.invoke('logout'),
  
  // Hardware
  getHardwareId: () => ipcRenderer.invoke('get-hardware-id'),
  getSecurityStatus: () => ipcRenderer.invoke('get-security-status'),
  
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
  }
});
