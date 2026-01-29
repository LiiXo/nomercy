import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import fetch from 'node-fetch';

const router = express.Router();

// Iris JWT secret (separate from main app)
const IRIS_JWT_SECRET = process.env.IRIS_JWT_SECRET || process.env.JWT_SECRET;

// Discord OAuth config
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1447607594351853618';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.NODE_ENV === 'production' 
  ? 'https://nomercy.ggsecure.io/iris/callback'
  : 'http://localhost:5173/iris/callback';

/**
 * Exchange Discord code for Iris token (called from frontend)
 * POST /api/iris/exchange-code
 */
router.post('/exchange-code', async (req, res) => {
  const { code } = req.body;
  
  console.log('[Iris] Exchange code request received');
  
  if (!code) {
    return res.status(400).json({ success: false, message: 'Code manquant' });
  }

  if (!DISCORD_CLIENT_SECRET) {
    console.error('[Iris] DISCORD_CLIENT_SECRET is not configured!');
    return res.status(500).json({ success: false, message: 'Erreur de configuration serveur' });
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: DISCORD_REDIRECT_URI
      })
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      console.error('[Iris] Discord token error:', tokenData);
      return res.status(400).json({ 
        success: false, 
        message: tokenData.error_description || 'Erreur d\'authentification Discord' 
      });
    }

    // Get Discord user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const discordUser = await userResponse.json();
    
    if (!discordUser.id) {
      return res.status(400).json({ success: false, message: 'Impossible de récupérer les informations Discord' });
    }

    console.log('[Iris] Discord user:', discordUser.username);

    // Find user in NoMercy database
    const user = await User.findOne({ discordId: discordUser.id });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Aucun compte NoMercy trouvé. Créez d\'abord un compte sur NoMercy.' 
      });
    }

    // Check if user is admin
    if (!user.roles || !user.roles.includes('admin')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Iris est disponible uniquement pour les administrateurs.' 
      });
    }

    // Check if user is banned
    if (user.isBanned) {
      return res.status(403).json({ success: false, message: user.banReason || 'Compte banni' });
    }

    // Generate Iris token
    const irisToken = jwt.sign(
      { userId: user._id, discordId: user.discordId, type: 'iris' },
      IRIS_JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Update user last seen
    user.irisLastSeen = new Date();
    await user.save();

    console.log('[Iris] Success! Token generated for:', discordUser.username);

    res.json({
      success: true,
      username: discordUser.username,
      redirectUrl: `iris://callback?token=${irisToken}`
    });

  } catch (error) {
    console.error('[Iris] Exchange code error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * Discord OAuth callback for Iris
 * GET /api/iris/discord-callback
 */
router.get('/discord-callback', async (req, res) => {
  const { code } = req.query;
  
  console.log('[Iris] Discord callback received, code:', code ? 'present' : 'missing');
  
  // Set content type to HTML explicitly
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  
  if (!code) {
    return res.status(400).send(renderErrorPage('Code d\'autorisation manquant'));
  }

  // Check if DISCORD_CLIENT_SECRET is configured
  if (!DISCORD_CLIENT_SECRET) {
    console.error('[Iris] DISCORD_CLIENT_SECRET is not configured!');
    return res.status(500).send(renderErrorPage('Erreur de configuration serveur', 'DISCORD_CLIENT_SECRET non configuré'));
  }

  try {
    console.log('[Iris] Exchanging code for token...');
    
    // Exchange code for token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: DISCORD_REDIRECT_URI
      })
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      console.error('[Iris] Discord token error:', tokenData);
      return res.status(400).send(renderErrorPage('Erreur d\'authentification Discord', tokenData.error_description || 'Token invalide'));
    }

    console.log('[Iris] Token received, fetching user info...');

    // Get Discord user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const discordUser = await userResponse.json();
    
    if (!discordUser.id) {
      console.error('[Iris] Discord user error:', discordUser);
      return res.status(400).send(renderErrorPage('Impossible de récupérer les informations Discord'));
    }

    console.log('[Iris] Discord user:', discordUser.username);

    // Find user in NoMercy database
    const user = await User.findOne({ discordId: discordUser.id });

    if (!user) {
      console.log('[Iris] User not found in database');
      return res.status(404).send(renderErrorPage(
        'Aucun compte NoMercy trouvé',
        'Vous devez d\'abord créer un compte sur NoMercy avec ce compte Discord.'
      ));
    }

    // Check if user is admin
    if (!user.roles || !user.roles.includes('admin')) {
      console.log('[Iris] User is not admin:', user.roles);
      return res.status(403).send(renderErrorPage(
        'Accès Refusé',
        'Iris est actuellement disponible uniquement pour les comptes administrateurs.'
      ));
    }

    // Check if user is banned
    if (user.isBanned) {
      return res.status(403).send(renderErrorPage('Compte banni', user.banReason || 'Votre compte a été banni.'));
    }

    // Generate Iris token
    const irisToken = jwt.sign(
      { 
        userId: user._id, 
        discordId: user.discordId,
        type: 'iris'
      },
      IRIS_JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Update user last seen
    user.irisLastSeen = new Date();
    await user.save();

    // Redirect to Iris app
    const redirectUrl = `iris://callback?token=${irisToken}`;
    
    console.log('[Iris] Success! Redirecting to:', redirectUrl.substring(0, 50) + '...');
    
    return res.send(renderSuccessPage(discordUser.username, redirectUrl));

  } catch (error) {
    console.error('[Iris] Discord callback error:', error);
    return res.status(500).send(renderErrorPage('Erreur serveur', error.message));
  }
});

// Helper: Render error page
function renderErrorPage(title, message = '') {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Iris - Erreur</title>
      <style>
        body { font-family: system-ui; background: #0a0a0b; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .container { text-align: center; padding: 40px; max-width: 400px; }
        .logo { width: 80px; height: 80px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
        .logo svg { width: 40px; height: 40px; color: white; }
        h1 { color: #ef4444; margin-bottom: 16px; }
        p { color: #71717a; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <h1>${title}</h1>
        <p>${message}</p>
      </div>
    </body>
    </html>
  `;
}

// Helper: Render success page
function renderSuccessPage(username, redirectUrl) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Iris - Autorisation réussie</title>
      <meta charset="utf-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0b; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; }
        .container { text-align: center; padding: 40px; max-width: 400px; }
        .logo { width: 80px; height: 80px; background: linear-gradient(135deg, #ff2d55 0%, #ff6b2c 100%); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; box-shadow: 0 0 40px rgba(255, 45, 85, 0.4); }
        .logo svg { width: 40px; height: 40px; color: white; }
        h1 { color: #ff2d55; margin-bottom: 8px; font-family: 'Bebas Neue', system-ui; letter-spacing: 4px; font-size: 32px; }
        .welcome { color: #a1a1aa; margin-bottom: 8px; font-size: 14px; }
        .username { color: white; font-weight: 600; font-size: 18px; margin-bottom: 24px; }
        .success { color: #22c55e; margin-bottom: 16px; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .success svg { width: 20px; height: 20px; }
        .info { color: #71717a; font-size: 14px; margin-top: 24px; }
        .close-hint { color: #52525b; font-size: 12px; margin-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <h1>IRIS</h1>
        <p class="welcome">Bienvenue,</p>
        <p class="username">${username}</p>
        <p class="success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          Autorisation réussie
        </p>
        <p class="info">Retournez sur l'application Iris</p>
        <p class="close-hint">Vous pouvez fermer cet onglet</p>
      </div>
      <script>
        // Try to open Iris immediately
        window.location.href = "${redirectUrl}";
        
        // Fallback: try again after a short delay
        setTimeout(function() {
          window.location.href = "${redirectUrl}";
        }, 500);
      </script>
    </body>
    </html>
  `;
}

/**
 * Generate Iris JWT token
 */
const generateIrisToken = (userId, hardwareId) => {
  return jwt.sign(
    { userId, hardwareId, type: 'iris' },
    IRIS_JWT_SECRET,
    { expiresIn: '30d' }
  );
};

/**
 * Register a machine with a Discord account
 * POST /api/iris/register
 */
router.post('/register', async (req, res) => {
  try {
    const { discordId, discordUsername, discordAvatar, hardwareId, systemInfo } = req.body;

    if (!discordId || !hardwareId) {
      return res.status(400).json({
        success: false,
        message: 'Discord ID and Hardware ID are required'
      });
    }

    // Find user by Discord ID
    let user = await User.findOne({ discordId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No NoMercy account found with this Discord account. Please register on the website first.'
      });
    }

    // Check if user is banned
    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'Your account is banned',
        banReason: user.banReason,
        banExpiresAt: user.banExpiresAt
      });
    }

    // Check if this hardware ID is already linked to another account
    const existingHardwareUser = await User.findOne({ 
      'irisHardwareId': hardwareId,
      '_id': { $ne: user._id }
    });

    if (existingHardwareUser) {
      return res.status(403).json({
        success: false,
        message: 'This machine is already linked to another account'
      });
    }

    // Update user with Iris data
    user.irisHardwareId = hardwareId;
    user.irisSystemInfo = systemInfo;
    user.irisLastSeen = new Date();
    user.irisRegisteredAt = user.irisRegisteredAt || new Date();
    
    // Update Discord info
    user.discordUsername = discordUsername;
    user.discordAvatar = discordAvatar;
    
    await user.save();

    // Generate Iris token
    const token = generateIrisToken(user._id, hardwareId);

    res.json({
      success: true,
      message: 'Machine registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        discordUsername: user.discordUsername,
        avatar: user.avatarUrl
      }
    });
  } catch (error) {
    console.error('[Iris] Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

/**
 * Verify Iris token and return user info (for Iris desktop app)
 * GET /api/iris/verify
 */
router.get('/verify', verifyToken, async (req, res) => {
  try {
    // Check if user is admin (Iris is admin-only)
    if (!req.user.roles || !req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Iris is currently available for admin accounts only'
      });
    }

    res.json({
      success: true,
      user: {
        _id: req.user._id,
        discordId: req.user.discordId,
        username: req.user.username,
        avatarUrl: req.user.avatarUrl,
        platform: req.user.platform
      }
    });
  } catch (error) {
    console.error('[Iris] Verify GET error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * Register hardware for authenticated user (for Iris desktop app)
 * POST /api/iris/register-hardware
 */
router.post('/register-hardware', verifyToken, async (req, res) => {
  try {
    const { hardwareId, systemInfo } = req.body;

    if (!hardwareId) {
      return res.status(400).json({
        success: false,
        message: 'Hardware ID is required'
      });
    }

    // Check if user is admin
    if (!req.user.roles || !req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Iris is currently available for admin accounts only'
      });
    }

    // Check if hardware ID is already registered to another user
    const existingUser = await User.findOne({ 
      irisHardwareId: hardwareId,
      _id: { $ne: req.user._id }
    });

    if (existingUser) {
      return res.status(403).json({
        success: false,
        message: 'This machine is already registered to another account'
      });
    }

    // Update user with hardware info
    await User.findByIdAndUpdate(req.user._id, {
      irisHardwareId: hardwareId,
      irisSystemInfo: systemInfo,
      irisRegisteredAt: req.user.irisRegisteredAt || new Date(),
      irisLastSeen: new Date()
    });

    res.json({
      success: true,
      message: 'Hardware registered successfully'
    });
  } catch (error) {
    console.error('[Iris] Register hardware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * Iris authorization page - generates token and redirects to Iris app
 * GET /api/iris/authorize
 */
router.get('/authorize', verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.roles || !req.user.roles.includes('admin')) {
      return res.status(403).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Iris - Accès Refusé</title>
          <style>
            body { font-family: system-ui; background: #0a0a0b; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .container { text-align: center; padding: 40px; }
            h1 { color: #ff2d55; margin-bottom: 16px; }
            p { color: #71717a; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Accès Refusé</h1>
            <p>Iris est actuellement disponible uniquement pour les comptes administrateurs.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Generate Iris-specific token (longer expiry)
    const irisToken = jwt.sign(
      { 
        userId: req.user._id, 
        discordId: req.user.discordId,
        type: 'iris'
      },
      IRIS_JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Redirect to Iris app with token
    const redirectUrl = `iris://callback?token=${irisToken}`;
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Iris - Autorisation</title>
        <style>
          body { font-family: system-ui; background: #0a0a0b; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .container { text-align: center; padding: 40px; }
          .logo { width: 80px; height: 80px; background: linear-gradient(135deg, #ff2d55 0%, #ff6b2c 100%); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
          .logo svg { width: 40px; height: 40px; color: white; }
          h1 { color: #ff2d55; margin-bottom: 8px; font-family: 'Bebas Neue', sans-serif; letter-spacing: 4px; }
          p { color: #71717a; margin-bottom: 24px; }
          .success { color: #22c55e; }
          a { color: #ff2d55; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h1>IRIS</h1>
          <p class="success">Autorisation réussie !</p>
          <p>Redirection vers Iris...</p>
          <p><small>Si Iris ne s'ouvre pas, <a href="${redirectUrl}">cliquez ici</a></small></p>
        </div>
        <script>
          setTimeout(() => {
            window.location.href = "${redirectUrl}";
          }, 1000);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('[Iris] Authorize error:', error);
    res.status(500).send('Server error');
  }
});

/**
 * Verify an Iris session (legacy - for Iris desktop verification)
 * POST /api/iris/verify
 */
router.post('/verify', async (req, res) => {
  try {
    const { token, hardwareId } = req.body;

    if (!token || !hardwareId) {
      return res.status(400).json({
        success: false,
        reason: 'missing_data'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, IRIS_JWT_SECRET);
    } catch (err) {
      return res.json({
        success: false,
        reason: 'invalid_token'
      });
    }

    // Check token type
    if (decoded.type !== 'iris') {
      return res.json({
        success: false,
        reason: 'invalid_token_type'
      });
    }

    // Check hardware ID matches
    if (decoded.hardwareId !== hardwareId) {
      return res.json({
        success: false,
        reason: 'hardware_mismatch'
      });
    }

    // Find user
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.json({
        success: false,
        reason: 'user_not_found'
      });
    }

    // Check if user is banned
    if (user.isBanned) {
      return res.json({
        success: false,
        reason: 'banned',
        banReason: user.banReason,
        banExpiresAt: user.banExpiresAt
      });
    }

    // Verify hardware ID matches user's registered hardware
    if (user.irisHardwareId !== hardwareId) {
      return res.json({
        success: false,
        reason: 'hardware_not_registered'
      });
    }

    // Update last seen
    user.irisLastSeen = new Date();
    await user.save();

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        discordUsername: user.discordUsername,
        avatar: user.avatarUrl
      }
    });
  } catch (error) {
    console.error('[Iris] Verify error:', error);
    res.status(500).json({
      success: false,
      reason: 'server_error'
    });
  }
});

/**
 * Get Iris status for a user (admin only)
 * GET /api/iris/status/:userId
 */
router.get('/status/:userId', verifyToken, async (req, res) => {
  try {
    // Check if requester is admin
    if (!req.user.roles || !req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const user = await User.findById(req.params.userId).select(
      'username discordUsername irisHardwareId irisSystemInfo irisLastSeen irisRegisteredAt'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      iris: {
        isRegistered: !!user.irisHardwareId,
        hardwareId: user.irisHardwareId,
        systemInfo: user.irisSystemInfo,
        lastSeen: user.irisLastSeen,
        registeredAt: user.irisRegisteredAt
      }
    });
  } catch (error) {
    console.error('[Iris] Status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * Unlink Iris from user account (admin only)
 * DELETE /api/iris/unlink/:userId
 */
router.delete('/unlink/:userId', verifyToken, async (req, res) => {
  try {
    // Check if requester is admin
    if (!req.user.roles || !req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Clear Iris data
    user.irisHardwareId = undefined;
    user.irisSystemInfo = undefined;
    user.irisLastSeen = undefined;
    user.irisRegisteredAt = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Iris unlinked successfully'
    });
  } catch (error) {
    console.error('[Iris] Unlink error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * Get download info for authenticated users
 * GET /api/iris/download
 */
router.get('/download', verifyToken, async (req, res) => {
  try {
    // Check if user has a complete profile
    if (!req.user.isProfileComplete) {
      return res.status(403).json({
        success: false,
        message: 'Please complete your profile first'
      });
    }

    // Generate a time-limited download token
    const downloadToken = jwt.sign(
      { userId: req.user._id, purpose: 'iris_download' },
      IRIS_JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      success: true,
      downloadUrl: `/api/iris/installer?token=${downloadToken}`,
      version: '1.0.0',
      fileName: 'IrisSetup.exe'
    });
  } catch (error) {
    console.error('[Iris] Download info error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * Discord OAuth callback for Iris desktop app
 * GET /api/iris/callback
 */
router.get('/callback', (req, res) => {
  const { code } = req.query;
  
  if (code) {
    // Return a simple HTML page that sends the code back to the Electron app
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Iris - Connexion</title>
        <style>
          body { 
            font-family: system-ui; 
            background: #0a0a0b; 
            color: white; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            height: 100vh; 
            margin: 0;
          }
          .container { text-align: center; }
          h1 { color: #ff2d55; margin-bottom: 16px; }
          p { color: #71717a; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Connexion réussie</h1>
          <p>Vous pouvez fermer cette fenêtre.</p>
        </div>
      </body>
      </html>
    `);
  } else {
    res.status(400).send('Missing authorization code');
  }
});

export default router;
