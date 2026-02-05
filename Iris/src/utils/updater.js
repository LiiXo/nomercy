/**
 * Iris Auto-Update Module
 * 
 * Handles checking for updates, downloading, and installing new versions.
 */

const { app, dialog, shell } = require('electron');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Get current version from package.json
let currentVersion = '1.0.0';
try {
  const packageJson = require('../../package.json');
  currentVersion = packageJson.version || '1.0.0';
} catch (e) {
  console.error('[Updater] Could not read package.json');
}

console.log('[Updater] Current version:', currentVersion);

/**
 * Check for updates from the server
 * @param {function} secureApi - The secure API client
 * @returns {object} Update info or null
 */
async function checkForUpdate(secureApi) {
  try {
    console.log('[Updater] Checking for updates...');
    
    const response = await secureApi.post('/iris/updates/check', {
      version: currentVersion,
      platform: 'windows'
    });
    
    if (response.data.success && response.data.updateAvailable) {
      console.log('[Updater] Update available:', response.data.version);
      return {
        available: true,
        version: response.data.version,
        downloadUrl: response.data.downloadUrl,
        fileSize: response.data.fileSize,
        fileHash: response.data.fileHash,
        changelog: response.data.changelog,
        mandatory: response.data.mandatory
      };
    }
    
    console.log('[Updater] No update available');
    return { available: false };
  } catch (error) {
    console.error('[Updater] Check failed:', error.message);
    return { available: false, error: error.message };
  }
}

/**
 * Download an update file
 * @param {string} url - Download URL
 * @param {string} expectedHash - Expected SHA256 hash
 * @param {function} onProgress - Progress callback (percent)
 * @returns {string} Path to downloaded file
 */
async function downloadUpdate(url, expectedHash, onProgress) {
  return new Promise((resolve, reject) => {
    const tempDir = app.getPath('temp');
    const fileName = `iris-update-${Date.now()}.exe`;
    const filePath = path.join(tempDir, fileName);
    
    console.log('[Updater] Downloading to:', filePath);
    
    const file = fs.createWriteStream(filePath);
    const hash = crypto.createHash('sha256');
    
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(filePath);
        return downloadUpdate(response.headers.location, expectedHash, onProgress)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(filePath);
        return reject(new Error(`Download failed: HTTP ${response.statusCode}`));
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        hash.update(chunk);
        
        if (totalSize && onProgress) {
          const percent = Math.round((downloadedSize / totalSize) * 100);
          onProgress(percent);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        
        // Verify hash
        const fileHash = hash.digest('hex');
        console.log('[Updater] Downloaded file hash:', fileHash);
        
        if (expectedHash && fileHash.toLowerCase() !== expectedHash.toLowerCase()) {
          console.error('[Updater] Hash mismatch!');
          console.error('[Updater] Expected:', expectedHash);
          console.error('[Updater] Got:', fileHash);
          fs.unlinkSync(filePath);
          return reject(new Error('File hash verification failed'));
        }
        
        console.log('[Updater] Download complete, hash verified');
        resolve(filePath);
      });
    });
    
    request.on('error', (error) => {
      file.close();
      fs.unlinkSync(filePath);
      reject(error);
    });
    
    request.setTimeout(60000, () => {
      request.destroy();
      file.close();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      reject(new Error('Download timeout'));
    });
  });
}

/**
 * Install the update (run the installer and quit)
 * @param {string} installerPath - Path to the downloaded installer
 */
async function installUpdate(installerPath) {
  console.log('[Updater] Installing update:', installerPath);
  
  // Run the installer
  shell.openPath(installerPath);
  
  // Give it a moment to start, then quit
  setTimeout(() => {
    app.quit();
  }, 1000);
}

/**
 * Show update dialog to user
 * @param {object} updateInfo - Update information
 * @param {BrowserWindow} mainWindow - Main window reference
 * @returns {boolean} Whether user accepted the update
 */
async function showUpdateDialog(updateInfo, mainWindow) {
  const buttons = updateInfo.mandatory 
    ? ['Mettre à jour maintenant']
    : ['Mettre à jour', 'Plus tard'];
  
  const message = updateInfo.mandatory
    ? `Une mise à jour obligatoire est disponible (v${updateInfo.version}).\n\nVous devez mettre à jour pour continuer à utiliser Iris.`
    : `Une nouvelle version est disponible (v${updateInfo.version}).\n\nVoulez-vous mettre à jour maintenant ?`;
  
  const detail = updateInfo.changelog || '';
  
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Mise à jour disponible',
    message: message,
    detail: detail,
    buttons: buttons,
    defaultId: 0,
    cancelId: updateInfo.mandatory ? -1 : 1
  });
  
  return result.response === 0;
}

/**
 * Main update check and install flow
 * @param {function} secureApi - Secure API client
 * @param {BrowserWindow} mainWindow - Main window reference
 * @param {function} onStatus - Status callback
 */
async function performUpdateCheck(secureApi, mainWindow, onStatus) {
  try {
    onStatus({ status: 'checking' });
    
    const updateInfo = await checkForUpdate(secureApi);
    
    if (!updateInfo.available) {
      onStatus({ status: 'up-to-date' });
      return { needsUpdate: false };
    }
    
    onStatus({ 
      status: 'available', 
      version: updateInfo.version,
      mandatory: updateInfo.mandatory 
    });
    
    // Show dialog
    const userAccepted = await showUpdateDialog(updateInfo, mainWindow);
    
    if (!userAccepted) {
      if (updateInfo.mandatory) {
        // User can't skip mandatory updates
        onStatus({ status: 'mandatory-quit' });
        setTimeout(() => app.quit(), 2000);
        return { needsUpdate: true, mandatory: true };
      }
      onStatus({ status: 'skipped' });
      return { needsUpdate: false };
    }
    
    // Download update
    onStatus({ status: 'downloading', progress: 0 });
    
    const installerPath = await downloadUpdate(
      updateInfo.downloadUrl,
      updateInfo.fileHash,
      (percent) => {
        onStatus({ status: 'downloading', progress: percent });
        if (mainWindow) {
          mainWindow.webContents.send('update-progress', { percent });
        }
      }
    );
    
    onStatus({ status: 'installing' });
    
    // Report download to server
    try {
      await secureApi.post(`/iris/updates/${updateInfo.version}/downloaded`);
    } catch (e) {
      // Non-critical, ignore
    }
    
    // Install
    await installUpdate(installerPath);
    
    return { needsUpdate: true, installing: true };
  } catch (error) {
    console.error('[Updater] Update failed:', error);
    onStatus({ status: 'error', message: error.message });
    return { needsUpdate: false, error: error.message };
  }
}

/**
 * Get current version
 */
function getCurrentVersion() {
  return currentVersion;
}

module.exports = {
  checkForUpdate,
  downloadUpdate,
  installUpdate,
  showUpdateDialog,
  performUpdateCheck,
  getCurrentVersion
};
