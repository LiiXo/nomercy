import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import IrisUpdate from '../models/IrisUpdate.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { verifyIrisSignature, decryptIrisPayload } from '../middleware/iris.security.middleware.js';
import { createIrisScanChannel, sendIrisConnectionStatus, logIrisConnectionStatus, alertIrisMatchDisconnected, sendIrisShadowBan, sendIrisSecurityWarning } from '../services/discordBot.service.js';
import fetch from 'node-fetch';

const router = express.Router();

// Iris JWT secret (separate from main app)
const IRIS_JWT_SECRET = process.env.IRIS_JWT_SECRET || process.env.JWT_SECRET;

// Client authentication secret (must match client)
const CLIENT_AUTH_SECRET = Buffer.from('TlNfSVJJU19DTElFTlRfQVVUSF9TRUNSRVRfMjAyNF8hQCMkJV4mKigp', 'base64').toString();

// Expected client code hashes (update when releasing new versions)
// These are SHA-256 hashes of the combined critical files
const EXPECTED_CLIENT_HASHES = {
  '1.0.0': process.env.IRIS_CLIENT_HASH_1_0_0 || 'DEVELOPMENT_MODE', // Set in production
  'latest': process.env.IRIS_CLIENT_HASH_LATEST || 'DEVELOPMENT_MODE'
};

// Pending challenges (in production, use Redis with TTL)
const pendingChallenges = new Map();
const CHALLENGE_EXPIRY_MS = 60 * 1000; // 1 minute

// Verified sessions (in production, use Redis)
const verifiedSessions = new Map();
const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

// Cleanup expired challenges/sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of pendingChallenges.entries()) {
    if (now > data.expiresAt) pendingChallenges.delete(key);
  }
  for (const [key, data] of verifiedSessions.entries()) {
    if (now > data.expiresAt) verifiedSessions.delete(key);
  }
}, 60 * 1000);

// Background job to detect Iris disconnections and send notifications
// Runs every minute, checks for players who haven't sent heartbeat in 6+ minutes
setInterval(async () => {
  try {
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
    
    // Find ALL users who were connected but haven't sent heartbeat in 6+ minutes
    const disconnectedUsers = await User.find({
      irisWasConnected: true,
      irisLastSeen: { $lt: sixMinutesAgo }
    }).select('_id username discordUsername irisScanChannelId');
    
    for (const user of disconnectedUsers) {
      console.log('[Iris Monitor] Detected disconnection for:', user.username);
      
      // Send to global Iris logs channel (for all players)
      await logIrisConnectionStatus(
        { username: user.username, discordUsername: user.discordUsername },
        'disconnected'
      ).catch(err => console.error('[Iris Monitor] Global log error:', err.message));
      
      // Send to player's scan channel if they have one
      if (user.irisScanChannelId) {
        await sendIrisConnectionStatus(
          user.irisScanChannelId,
          { username: user.username, discordUsername: user.discordUsername },
          'disconnected'
        ).catch(err => console.error('[Iris Monitor] Scan channel notification error:', err.message));
      }
      
      // Update user to mark as disconnected
      await User.findByIdAndUpdate(user._id, {
        irisWasConnected: false
      });
    }
    
    if (disconnectedUsers.length > 0) {
      console.log(`[Iris Monitor] Processed ${disconnectedUsers.length} disconnection(s)`);
    }
  } catch (error) {
    console.error('[Iris Monitor] Error checking disconnections:', error.message);
  }
}, 60 * 1000); // Run every minute

// Discord OAuth config
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1447607594351853618';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.NODE_ENV === 'production' 
  ? 'https://nomercy.ggsecure.io/api/iris/discord-callback'
  : 'http://localhost:5000/api/iris/discord-callback';

console.log('[Iris] Discord Redirect URI:', DISCORD_REDIRECT_URI);
console.log('[Iris] Security middleware enabled');
console.log('[Iris] Client authentication enabled');

// ====== CLIENT AUTHENTICATION ENDPOINTS ======

/**
 * Request a challenge for client authentication
 * POST /api/iris/auth/challenge
 * 
 * Client must solve this challenge to prove authenticity
 */
router.post('/auth/challenge', verifyIrisSignature, async (req, res) => {
  try {
    // Get token from Authorization header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Verify Iris token
    let decoded;
    try {
      decoded = jwt.verify(token, IRIS_JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (decoded.type !== 'iris') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const { hardwareId, version, codeHash } = req.body;

    if (!hardwareId || !version) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check client version
    if (!['1.0.0', '1.0.1', '1.1.0'].includes(version)) {
      console.warn('[Iris Auth] Unknown client version:', version, 'from', user.username);
    }

    // Check code hash in production
    const isDev = process.env.NODE_ENV !== 'production';
    if (!isDev) {
      const expectedHash = EXPECTED_CLIENT_HASHES[version] || EXPECTED_CLIENT_HASHES['latest'];
      if (expectedHash !== 'DEVELOPMENT_MODE' && codeHash !== expectedHash) {
        console.warn('[Iris Auth] Code hash mismatch for', user.username);
        console.warn('[Iris Auth] Expected:', expectedHash, 'Got:', codeHash);
        return res.status(403).json({
          success: false,
          message: 'Client integrity check failed',
          reason: 'hash_mismatch',
          blocked: true
        });
      }
    }

    // Generate random challenge
    const challenge = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + CHALLENGE_EXPIRY_MS;
    
    // Store pending challenge
    const challengeKey = `${user._id}_${hardwareId}`;
    pendingChallenges.set(challengeKey, {
      challenge,
      userId: user._id.toString(),
      hardwareId,
      version,
      codeHash,
      expiresAt,
      createdAt: Date.now()
    });

    console.log('[Iris Auth] Challenge issued for:', user.username);

    res.json({
      success: true,
      challenge,
      expiresAt
    });
  } catch (error) {
    console.error('[Iris Auth] Challenge error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * Verify client challenge response
 * POST /api/iris/auth/verify
 * 
 * Client submits signed challenge response to prove authenticity
 */
router.post('/auth/verify', verifyIrisSignature, async (req, res) => {
  try {
    // Get token from Authorization header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Verify Iris token
    let decoded;
    try {
      decoded = jwt.verify(token, IRIS_JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (decoded.type !== 'iris') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const { challenge, hardwareId, timestamp, codeHash, version, pid, signature, fileHashes } = req.body;

    if (!challenge || !hardwareId || !timestamp || !signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Find pending challenge
    const challengeKey = `${user._id}_${hardwareId}`;
    const pendingChallenge = pendingChallenges.get(challengeKey);

    if (!pendingChallenge) {
      console.warn('[Iris Auth] No pending challenge for:', user.username);
      return res.status(400).json({
        success: false,
        reason: 'no_challenge',
        message: 'No pending challenge found'
      });
    }

    // Check challenge expiry
    if (Date.now() > pendingChallenge.expiresAt) {
      pendingChallenges.delete(challengeKey);
      return res.status(400).json({
        success: false,
        reason: 'expired',
        message: 'Challenge expired'
      });
    }

    // Verify challenge matches
    if (challenge !== pendingChallenge.challenge) {
      console.warn('[Iris Auth] Challenge mismatch for:', user.username);
      return res.status(400).json({
        success: false,
        reason: 'challenge_mismatch',
        message: 'Invalid challenge'
      });
    }

    // Verify signature
    const responseData = {
      challenge,
      hardwareId,
      timestamp,
      codeHash,
      version,
      pid
    };
    
    const dataToSign = JSON.stringify(responseData);
    const expectedSignature = crypto.createHmac('sha256', CLIENT_AUTH_SECRET)
      .update(dataToSign)
      .digest('hex');

    // Constant-time comparison
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    
    if (sigBuffer.length !== expectedBuffer.length || 
        !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      console.warn('[Iris Auth] SIGNATURE MISMATCH for:', user.username);
      console.warn('[Iris Auth] This may indicate a modified client!');
      
      // Mark user as using tampered client
      await User.findByIdAndUpdate(user._id, {
        'irisSecurityStatus.clientTampered': true,
        'irisSecurityStatus.tamperDetectedAt': new Date()
      });

      pendingChallenges.delete(challengeKey);
      return res.status(403).json({
        success: false,
        reason: 'signature_invalid',
        message: 'Client authenticity verification failed',
        blocked: true
      });
    }

    // Check timestamp is recent (within 2 minutes)
    if (Math.abs(Date.now() - timestamp) > 2 * 60 * 1000) {
      console.warn('[Iris Auth] Timestamp too old for:', user.username);
      return res.status(400).json({
        success: false,
        reason: 'timestamp_invalid',
        message: 'Response timestamp invalid'
      });
    }

    // Success - Create verified session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionExpiresAt = Date.now() + SESSION_EXPIRY_MS;

    verifiedSessions.set(sessionToken, {
      userId: user._id.toString(),
      hardwareId,
      codeHash,
      version,
      expiresAt: sessionExpiresAt,
      verifiedAt: Date.now()
    });

    // Update user verification status
    await User.findByIdAndUpdate(user._id, {
      irisClientVerified: true,
      irisClientVersion: version,
      irisClientCodeHash: codeHash,
      irisVerifiedAt: new Date()
    });

    // Clean up pending challenge
    pendingChallenges.delete(challengeKey);

    console.log('[Iris Auth] Client verified for:', user.username, '- Version:', version);

    res.json({
      success: true,
      sessionToken,
      expiresAt: sessionExpiresAt,
      message: 'Client authenticated successfully'
    });
  } catch (error) {
    console.error('[Iris Auth] Verify error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * Check if a session is still valid
 * GET /api/iris/auth/session
 */
router.get('/auth/session', verifyIrisSignature, async (req, res) => {
  try {
    const sessionToken = req.headers['x-iris-session'];
    
    if (!sessionToken) {
      return res.json({
        success: false,
        valid: false,
        message: 'No session token'
      });
    }

    const session = verifiedSessions.get(sessionToken);
    
    if (!session) {
      return res.json({
        success: false,
        valid: false,
        message: 'Session not found'
      });
    }

    if (Date.now() > session.expiresAt) {
      verifiedSessions.delete(sessionToken);
      return res.json({
        success: false,
        valid: false,
        message: 'Session expired'
      });
    }

    res.json({
      success: true,
      valid: true,
      expiresAt: session.expiresAt,
      version: session.version
    });
  } catch (error) {
    console.error('[Iris Auth] Session check error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * Helper: Check if client is verified (for other routes)
 */
function isClientVerified(sessionToken) {
  if (!sessionToken) return false;
  const session = verifiedSessions.get(sessionToken);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    verifiedSessions.delete(sessionToken);
    return false;
  }
  return true;
}

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
  console.log('[Iris] Redirect URI being used:', DISCORD_REDIRECT_URI);
  
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
    console.log('[Iris] Client ID:', DISCORD_CLIENT_ID);
    
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

    console.log('[Iris] Token response status:', tokenResponse.status);
    const tokenData = await tokenResponse.json();
    console.log('[Iris] Token data keys:', Object.keys(tokenData));
    
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
        // Open Iris only once
        var opened = false;
        function openIris() {
          if (!opened) {
            opened = true;
            window.location.href = "${redirectUrl}";
          }
        }
        // Try after page load
        window.onload = function() {
          setTimeout(openIris, 100);
        };
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
 * Protected by: HMAC signature verification
 */
router.get('/verify', verifyIrisSignature, async (req, res) => {
  try {
    // Get token from Authorization header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Verify Iris token with IRIS_JWT_SECRET
    let decoded;
    try {
      decoded = jwt.verify(token, IRIS_JWT_SECRET);
    } catch (err) {
      console.error('[Iris] Token verification failed:', err.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    // Check if it's an Iris token
    if (decoded.type !== 'iris') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    // Find user by userId (Iris tokens use userId, not id)
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is admin (Iris is admin-only)
    if (!user.roles || !user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Iris is currently available for admin accounts only'
      });
    }

    // Check if banned
    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: user.banReason || 'Account banned'
      });
    }

    console.log('[Iris] Token verified for user:', user.username);

    res.json({
      success: true,
      user: {
        _id: user._id,
        discordId: user.discordId,
        username: user.username,
        avatarUrl: user.avatarUrl,
        platform: user.platform
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
 * Protected by: HMAC signature verification + encrypted payload support
 */
router.post('/register-hardware', verifyIrisSignature, decryptIrisPayload, async (req, res) => {
  try {
    // Get token from Authorization header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Verify Iris token
    let decoded;
    try {
      decoded = jwt.verify(token, IRIS_JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (decoded.type !== 'iris') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const { hardwareId, systemInfo } = req.body;

    if (!hardwareId) {
      return res.status(400).json({
        success: false,
        message: 'Hardware ID is required'
      });
    }

    // Check if user is admin
    if (!user.roles || !user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Iris is currently available for admin accounts only'
      });
    }

    // Check if hardware ID is already registered to another user
    const existingUser = await User.findOne({ 
      irisHardwareId: hardwareId,
      _id: { $ne: user._id }
    });

    if (existingUser) {
      return res.status(403).json({
        success: false,
        message: 'This machine is already registered to another account'
      });
    }

    // Update user with hardware info
    await User.findByIdAndUpdate(user._id, {
      irisHardwareId: hardwareId,
      irisSystemInfo: systemInfo,
      irisRegisteredAt: user.irisRegisteredAt || new Date(),
      irisLastSeen: new Date()
    });

    console.log('[Iris] Hardware registered for user:', user.username);

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

/**
 * Heartbeat - Receive security status from Iris client every 5 minutes
 * POST /api/iris/heartbeat
 * Protected by: HMAC signature verification + encrypted payload support
 * 
 * Includes server-side verification of raw outputs to prevent data falsification
 */
router.post('/heartbeat', verifyIrisSignature, decryptIrisPayload, async (req, res) => {
  try {
    // Get token from Authorization header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Verify Iris token
    let decoded;
    try {
      decoded = jwt.verify(token, IRIS_JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (decoded.type !== 'iris') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // ====== CLIENT SESSION VERIFICATION ======
    // Check if client has a valid verified session
    const clientSession = req.headers['x-iris-session'] || req.body.clientSession;
    const isDev = process.env.NODE_ENV !== 'production';
    
    if (!isDev) {
      if (!clientSession) {
        console.warn('[Iris Heartbeat] No client session for:', user.username);
        return res.status(403).json({
          success: false,
          message: 'Client not verified',
          requiresVerification: true
        });
      }
      
      if (!isClientVerified(clientSession)) {
        console.warn('[Iris Heartbeat] Invalid/expired client session for:', user.username);
        return res.status(403).json({
          success: false,
          message: 'Client session invalid or expired',
          requiresVerification: true
        });
      }
      
      // Verify session belongs to this user
      const session = verifiedSessions.get(clientSession);
      if (session && session.userId !== user._id.toString()) {
        console.warn('[Iris Heartbeat] Session user mismatch for:', user.username);
        return res.status(403).json({
          success: false,
          message: 'Session user mismatch',
          requiresVerification: true
        });
      }
    }

    const { hardwareId, security, verification, integrity, antiTamper } = req.body;

    if (!hardwareId) {
      return res.status(400).json({
        success: false,
        message: 'Hardware ID is required'
      });
    }

    // ====== VERIFICATION: Detect Data Falsification ======
    let verificationResult = {
      verified: false,
      tamperDetected: false,
      issues: []
    };

    // Check if verification data is present (new client with integrity checks)
    if (verification && verification.rawOutputs) {
      console.log('[Iris Heartbeat] Verifying raw outputs for:', user.username);
      
      // 1. Verify TPM status matches raw output
      if (verification.rawOutputs.tpm && !verification.rawOutputs.tpm.startsWith('ERROR')) {
        try {
          const tpmParsed = JSON.parse(verification.rawOutputs.tpm);
          const expectedPresent = tpmParsed.Present === true;
          const expectedEnabled = tpmParsed.Ready === true || tpmParsed.Enabled === true;
          
          if (security.tpm.present !== expectedPresent || security.tpm.enabled !== expectedEnabled) {
            verificationResult.issues.push('TPM status mismatch');
            verificationResult.tamperDetected = true;
          }
        } catch (e) {
          // JSON parse error - check text
          const tpmText = verification.rawOutputs.tpm.toLowerCase();
          if (security.tpm.present && !tpmText.includes('true') && !tpmText.includes('present')) {
            verificationResult.issues.push('TPM parse mismatch');
          }
        }
      }

      // 2. Verify Secure Boot matches raw output
      if (verification.rawOutputs.secureBoot) {
        const expectedSecureBoot = verification.rawOutputs.secureBoot.includes('0x1');
        if (security.secureBoot !== expectedSecureBoot) {
          verificationResult.issues.push('Secure Boot status mismatch');
          verificationResult.tamperDetected = true;
        }
      }

      // 3. Verify DeviceGuard (VBS/HVCI) matches raw output
      if (verification.rawOutputs.deviceGuard && !verification.rawOutputs.deviceGuard.startsWith('ERROR')) {
        try {
          const dgParsed = JSON.parse(verification.rawOutputs.deviceGuard);
          const expectedVbs = dgParsed.VirtualizationBasedSecurityStatus >= 1;
          
          if (security.vbs !== expectedVbs) {
            verificationResult.issues.push('VBS status mismatch');
            verificationResult.tamperDetected = true;
          }
        } catch (e) {}
      }

      // 4. Verify Defender matches raw output
      if (verification.rawOutputs.defender && !verification.rawOutputs.defender.startsWith('ERROR')) {
        try {
          const defParsed = JSON.parse(verification.rawOutputs.defender);
          const expectedDefender = defParsed.AntivirusEnabled === true;
          
          if (security.defender !== expectedDefender) {
            verificationResult.issues.push('Defender status mismatch');
            verificationResult.tamperDetected = true;
          }
        } catch (e) {}
      }

      // 5. Check timestamp freshness (prevent replay with old data)
      if (verification.timestamp) {
        const timestampAge = Date.now() - verification.timestamp;
        if (timestampAge > 2 * 60 * 1000) { // More than 2 minutes old
          verificationResult.issues.push('Stale verification data');
        }
      }

      verificationResult.verified = verificationResult.issues.length === 0;
    }

    // ====== ANTI-TAMPER: Check for debugging/hooking ======
    let antiTamperResult = {
      clean: true,
      alerts: []
    };

    if (antiTamper && antiTamper.debugChecks) {
      if (antiTamper.debugChecks.suspiciousParent) {
        antiTamperResult.alerts.push('Suspicious process detected');
        antiTamperResult.clean = false;
      }
      if (antiTamper.debugChecks.debuggerAttached) {
        antiTamperResult.alerts.push('Debugger detected');
        antiTamperResult.clean = false;
      }
      if (antiTamper.debugChecks.timeAnomaly) {
        antiTamperResult.alerts.push('Timing anomaly detected');
      }
    }

    // ====== INTEGRITY: Store client code hash for tracking ======
    let integrityInfo = null;
    if (integrity) {
      integrityInfo = {
        codeHash: integrity.codeHash,
        attestationHash: integrity.attestationHash,
        timestamp: new Date()
      };
    }

    // Log any issues
    if (verificationResult.tamperDetected) {
      console.warn('[Iris Heartbeat] TAMPER DETECTED for', user.username, ':', verificationResult.issues);
    }
    if (!antiTamperResult.clean) {
      console.warn('[Iris Heartbeat] ANTI-TAMPER ALERT for', user.username, ':', antiTamperResult.alerts);
    }

    // Update user with heartbeat data + verification status
    // Extract systemInfo from request body
    const { systemInfo } = req.body;
    
    // Check if user was previously disconnected (for connection notification)
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
    const wasDisconnected = !user.irisWasConnected || 
      (user.irisLastSeen && new Date(user.irisLastSeen) < sixMinutesAgo);
    
    await User.findByIdAndUpdate(user._id, {
      irisLastSeen: new Date(),
      irisWasConnected: true,
      irisSecurityStatus: {
        ...security,
        // Process and device info (from systemInfo)
        processes: systemInfo?.processes || [],
        usbDevices: systemInfo?.usbDevices || [],
        cheatDetection: systemInfo?.cheatDetection || { found: false, devices: [], processes: [], warnings: [] },
        // Add verification metadata
        verified: verificationResult.verified,
        tamperDetected: verificationResult.tamperDetected,
        verificationIssues: verificationResult.issues,
        antiTamperClean: antiTamperResult.clean,
        antiTamperAlerts: antiTamperResult.alerts,
        integrityHash: integrity?.codeHash,
        verifiedAt: new Date()
      },
      irisHardwareId: hardwareId
    });

    // Send connection notification to Discord scan channel if player just connected
    if (wasDisconnected) {
      console.log('[Iris Heartbeat] Player reconnected:', user.username);
      
      // Include cheat detection data in notification
      const securityData = systemInfo?.cheatDetection?.found ? {
        cheatDetection: systemInfo.cheatDetection
      } : null;
      
      // Send to global Iris logs channel (for all players)
      await logIrisConnectionStatus(
        { username: user.username, discordUsername: user.discordUsername },
        'connected',
        securityData
      ).catch(err => console.error('[Iris Heartbeat] Global log error:', err.message));
      
      // Send to player's scan channel if they have one
      if (user.irisScanChannelId) {
        await sendIrisConnectionStatus(
          user.irisScanChannelId,
          { username: user.username, discordUsername: user.discordUsername },
          'connected',
          securityData
        ).catch(err => console.error('[Iris Heartbeat] Scan channel notification error:', err.message));
      }
    }

    // Log cheat detection
    if (systemInfo?.cheatDetection?.found) {
      console.warn('[Iris Heartbeat] CHEAT DEVICE DETECTED for', user.username, ':', systemInfo.cheatDetection.warnings);
      
      // ====== AUTO SHADOW BAN for cheat detection ======
      // Only ban if not already banned and detection is critical/high
      const riskLevel = systemInfo.cheatDetection.riskLevel || 'low';
      const shouldBan = (riskLevel === 'critical' || riskLevel === 'high') && !user.isBanned;
      
      if (shouldBan) {
        // Build reason from detected items
        const detectedItems = [];
        if (systemInfo.cheatDetection.devices?.length > 0) {
          detectedItems.push(...systemInfo.cheatDetection.devices.map(d => d.type || d.name));
        }
        if (systemInfo.cheatDetection.processes?.length > 0) {
          detectedItems.push(...systemInfo.cheatDetection.processes.map(p => p.matchedCheat || p.name));
        }
        const detectedReason = detectedItems.slice(0, 3).join(', ') || 'logiciel/périphérique suspect';
        
        // Set ban for 24 hours
        const banEndDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        await User.findByIdAndUpdate(user._id, {
          isBanned: true,
          banReason: `Shadow ban pour ${detectedReason}`,
          banStartDate: new Date(),
          banEndDate: banEndDate
        });
        
        console.warn(`[Iris Heartbeat] AUTO SHADOW BAN applied to ${user.username} for: ${detectedReason}`);
        
        // Send Discord notification
        await sendIrisShadowBan(
          {
            username: user.username,
            discordUsername: user.discordUsername,
            discordId: user.discordId
          },
          detectedReason,
          24,
          systemInfo.cheatDetection
        ).catch(err => console.error('[Iris Heartbeat] Shadow ban notification error:', err.message));
      }
    }
    
    // ====== SECURITY MODULE CHECK ======
    // Check for missing/disabled security modules and send warning
    const missingModules = [];
    
    if (security) {
      // Check TPM
      if (!security.tpm?.enabled && !security.tpm?.present) {
        missingModules.push({ name: 'TPM', status: 'Désactivé ou non présent' });
      }
      
      // Check Secure Boot
      if (!security.secureBoot) {
        missingModules.push({ name: 'Secure Boot', status: 'Désactivé' });
      }
      
      // Check Virtualization
      if (!security.virtualization) {
        missingModules.push({ name: 'Virtualization', status: 'Désactivé (VT-x/AMD-V)' });
      }
      
      // Check Windows Defender
      if (!security.defender) {
        missingModules.push({ name: 'Defender', status: 'Désactivé' });
      }
    }
    
    // Send security warning if critical modules are missing (TPM is critical)
    if (missingModules.some(m => m.name === 'TPM')) {
      // Check if we already sent a warning recently (within last hour) to avoid spam
      const lastWarning = user.irisSecurityStatus?.lastSecurityWarning;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      if (!lastWarning || new Date(lastWarning) < oneHourAgo) {
        console.warn(`[Iris Heartbeat] Missing security modules for ${user.username}:`, missingModules.map(m => m.name).join(', '));
        
        await sendIrisSecurityWarning(
          {
            username: user.username,
            discordUsername: user.discordUsername,
            discordId: user.discordId
          },
          missingModules
        ).catch(err => console.error('[Iris Heartbeat] Security warning notification error:', err.message));
        
        // Update last warning timestamp
        await User.findByIdAndUpdate(user._id, {
          'irisSecurityStatus.lastSecurityWarning': new Date(),
          'irisSecurityStatus.missingModules': missingModules.map(m => m.name)
        });
      }
    }

    console.log('[Iris Heartbeat] Received from:', user.username, 
      '| Verified:', verificationResult.verified,
      '| Tamper:', verificationResult.tamperDetected,
      '| Clean:', antiTamperResult.clean
    );

    res.json({
      success: true,
      message: 'Heartbeat received',
      verified: verificationResult.verified,
      tamperDetected: verificationResult.tamperDetected
    });
  } catch (error) {
    console.error('[Iris Heartbeat] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * Get list of connected Iris players (for admin panel)
 * GET /api/iris/connected-players
 * Accessible by: admin, staff, arbitre
 * Now includes ALL PC platform users, not just those with Iris data
 */
router.get('/connected-players', verifyToken, async (req, res) => {
  try {
    // Check if user has permission
    const allowedRoles = ['admin', 'staff', 'arbitre'];
    const hasPermission = req.user.roles && req.user.roles.some(role => allowedRoles.includes(role));
    
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { search } = req.query;

    // Get all users with PC platform OR Iris data
    // Consider connected if last seen within 6 minutes
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
    
    // Build query: PC platform users OR users with Iris data
    const query = {
      $or: [
        { platform: 'PC' },
        { irisLastSeen: { $exists: true } }
      ]
    };

    // Add search filter if provided
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$and = [
        query.$or ? { $or: query.$or } : {},
        {
          $or: [
            { username: searchRegex },
            { discordUsername: searchRegex },
            { activisionId: searchRegex }
          ]
        }
      ];
      delete query.$or;
    }
    
    const players = await User.find(query)
      .select('username avatar discordAvatar discordUsername discordId platform activisionId createdAt irisLastSeen irisSecurityStatus irisHardwareId irisRegisteredAt')
      .lean();

    // Helper to compute avatar URL
    const getAvatarUrl = (player) => {
      // Custom uploaded avatar
      if (player.avatar && player.avatar.startsWith('/uploads/')) {
        return `${process.env.API_URL || 'https://api-nomercy.ggsecure.io'}${player.avatar}`;
      }
      // Discord avatar
      if (player.discordAvatar && player.discordId) {
        return `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png`;
      }
      // Already a full URL
      if (player.avatar && player.avatar.startsWith('http')) {
        return player.avatar;
      }
      return null;
    };

    // Map players with connection status
    const result = players.map(player => ({
      _id: player._id,
      username: player.username,
      discordUsername: player.discordUsername,
      discordId: player.discordId,
      avatarUrl: getAvatarUrl(player),
      platform: player.platform,
      activisionId: player.activisionId,
      createdAt: player.createdAt,
      lastSeen: player.irisLastSeen,
      registeredAt: player.irisRegisteredAt,
      isConnected: player.irisLastSeen && new Date(player.irisLastSeen) > sixMinutesAgo,
      hasIrisData: !!player.irisLastSeen,
      security: player.irisSecurityStatus || null,
      hardwareId: player.irisHardwareId
    }));

    // Sort: connected first, then by last seen (nulls last)
    result.sort((a, b) => {
      // Connected first
      if (a.isConnected && !b.isConnected) return -1;
      if (!a.isConnected && b.isConnected) return 1;
      // Then by last seen (most recent first, nulls last)
      if (a.lastSeen && !b.lastSeen) return -1;
      if (!a.lastSeen && b.lastSeen) return 1;
      if (a.lastSeen && b.lastSeen) {
        return new Date(b.lastSeen) - new Date(a.lastSeen);
      }
      return 0;
    });

    res.json({
      success: true,
      players: result,
      total: result.length,
      connected: result.filter(p => p.isConnected).length,
      pcPlatform: result.filter(p => p.platform === 'PC').length
    });
  } catch (error) {
    console.error('[Iris] Connected players error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ====== IRIS UPDATE MANAGEMENT (Admin Only) ======

/**
 * Check for updates (Iris client endpoint)
 * POST /api/iris/updates/check
 */
router.post('/updates/check', verifyIrisSignature, async (req, res) => {
  try {
    const { version, platform = 'windows' } = req.body;
    
    if (!version) {
      return res.status(400).json({
        success: false,
        message: 'Version is required'
      });
    }
    
    const updateInfo = await IrisUpdate.checkForUpdate(version, platform);
    
    res.json({
      success: true,
      ...updateInfo
    });
  } catch (error) {
    console.error('[Iris Updates] Check error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * Get all updates (Admin only)
 * GET /api/iris/updates
 */
router.get('/updates', verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user._id);
    if (!user || !user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé - Admin uniquement'
      });
    }
    
    const updates = await IrisUpdate.find()
      .populate('publishedBy', 'username')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      updates
    });
  } catch (error) {
    console.error('[Iris Updates] Get all error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * Create new update (Admin only)
 * POST /api/iris/updates
 */
router.post('/updates', verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user._id);
    if (!user || !user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé - Admin uniquement'
      });
    }
    
    const { 
      version, 
      codeHash, 
      downloadUrl, 
      fileSize, 
      fileHash, 
      changelog, 
      mandatory, 
      minVersion,
      isCurrent,
      platform 
    } = req.body;
    
    // Validate required fields
    if (!version || !codeHash || !downloadUrl || !fileHash) {
      return res.status(400).json({
        success: false,
        message: 'Version, codeHash, downloadUrl et fileHash sont requis'
      });
    }
    
    // Check if version already exists
    const existing = await IrisUpdate.findOne({ version });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Cette version existe déjà'
      });
    }
    
    const update = new IrisUpdate({
      version,
      codeHash,
      downloadUrl,
      fileSize: fileSize || 0,
      fileHash,
      changelog: changelog || '',
      mandatory: mandatory || false,
      minVersion: minVersion || null,
      isCurrent: isCurrent || false,
      platform: platform || 'windows',
      publishedBy: user._id
    });
    
    await update.save();
    
    console.log('[Iris Updates] New update created:', version, 'by', user.username);
    
    res.json({
      success: true,
      message: 'Mise à jour créée',
      update
    });
  } catch (error) {
    console.error('[Iris Updates] Create error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * Update an existing update (Admin only)
 * PUT /api/iris/updates/:id
 */
router.put('/updates/:id', verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user._id);
    if (!user || !user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé - Admin uniquement'
      });
    }
    
    const update = await IrisUpdate.findById(req.params.id);
    if (!update) {
      return res.status(404).json({
        success: false,
        message: 'Mise à jour non trouvée'
      });
    }
    
    const allowedFields = [
      'downloadUrl', 'fileSize', 'fileHash', 'changelog', 
      'mandatory', 'minVersion', 'isCurrent', 'isActive', 'codeHash'
    ];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        update[field] = req.body[field];
      }
    }
    
    await update.save();
    
    console.log('[Iris Updates] Update modified:', update.version, 'by', user.username);
    
    res.json({
      success: true,
      message: 'Mise à jour modifiée',
      update
    });
  } catch (error) {
    console.error('[Iris Updates] Update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * Set an update as current (Admin only)
 * POST /api/iris/updates/:id/set-current
 */
router.post('/updates/:id/set-current', verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user._id);
    if (!user || !user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé - Admin uniquement'
      });
    }
    
    const update = await IrisUpdate.findById(req.params.id);
    if (!update) {
      return res.status(404).json({
        success: false,
        message: 'Mise à jour non trouvée'
      });
    }
    
    // Unset current on all other versions for this platform
    await IrisUpdate.updateMany(
      { _id: { $ne: update._id }, platform: update.platform },
      { isCurrent: false }
    );
    
    // Set this as current
    update.isCurrent = true;
    await update.save();
    
    console.log('[Iris Updates] Set current:', update.version, 'by', user.username);
    
    res.json({
      success: true,
      message: `Version ${update.version} définie comme version actuelle`,
      update
    });
  } catch (error) {
    console.error('[Iris Updates] Set current error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * Delete an update (Admin only)
 * DELETE /api/iris/updates/:id
 */
router.delete('/updates/:id', verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user._id);
    if (!user || !user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé - Admin uniquement'
      });
    }
    
    const update = await IrisUpdate.findById(req.params.id);
    if (!update) {
      return res.status(404).json({
        success: false,
        message: 'Mise à jour non trouvée'
      });
    }
    
    // Don't allow deleting current version
    if (update.isCurrent) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer la version actuelle'
      });
    }
    
    await IrisUpdate.findByIdAndDelete(req.params.id);
    
    console.log('[Iris Updates] Deleted:', update.version, 'by', user.username);
    
    res.json({
      success: true,
      message: 'Mise à jour supprimée'
    });
  } catch (error) {
    console.error('[Iris Updates] Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * Increment download count (Iris client endpoint)
 * POST /api/iris/updates/:version/downloaded
 */
router.post('/updates/:version/downloaded', verifyIrisSignature, async (req, res) => {
  try {
    const update = await IrisUpdate.findOne({ version: req.params.version });
    if (update) {
      update.downloadCount += 1;
      await update.save();
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Iris Updates] Download count error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ====== IRIS SCAN (Admin Only) ======

/**
 * Initiate Iris Scan for a suspicious player
 * POST /api/iris/scan/:userId
 * Creates a Discord channel with player info and security status
 * Admin only
 */
router.post('/scan/:userId', verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    const admin = await User.findById(req.user._id);
    if (!admin || !admin.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé - Admin uniquement'
      });
    }

    const { userId } = req.params;

    // Find the target player
    const player = await User.findById(userId)
      .select('username discordUsername discordId avatar discordAvatar platform activisionId createdAt irisSecurityStatus irisHardwareId irisLastSeen')
      .lean();

    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Joueur non trouvé'
      });
    }

    // Compute avatar URL
    let avatarUrl = null;
    if (player.avatar && player.avatar.startsWith('/uploads/')) {
      avatarUrl = `${process.env.API_URL || 'https://api-nomercy.ggsecure.io'}${player.avatar}`;
    } else if (player.discordAvatar && player.discordId) {
      avatarUrl = `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png`;
    } else if (player.avatar && player.avatar.startsWith('http')) {
      avatarUrl = player.avatar;
    }

    // Create Discord channel with player info
    const result = await createIrisScanChannel(
      {
        username: player.username,
        discordUsername: player.discordUsername,
        discordId: player.discordId,
        avatarUrl: avatarUrl,
        platform: player.platform,
        activisionId: player.activisionId,
        createdAt: player.createdAt,
        hardwareId: player.irisHardwareId
      },
      player.irisSecurityStatus,
      { username: admin.username }
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || 'Erreur lors de la création du salon Discord'
      });
    }

    // Save the scan channel ID to the user for future notifications
    if (result.channelId && !result.alreadyExists) {
      await User.findByIdAndUpdate(userId, {
        irisScanChannelId: result.channelId
      });
    }

    console.log(`[Iris Scan] Channel created for ${player.username || player.discordUsername} by ${admin.username}`);

    res.json({
      success: true,
      message: result.alreadyExists 
        ? 'Salon de scan existant' 
        : 'Salon de scan créé',
      channelId: result.channelId,
      channelUrl: result.channelUrl,
      alreadyExists: result.alreadyExists
    });
  } catch (error) {
    console.error('[Iris Scan] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

export default router;
