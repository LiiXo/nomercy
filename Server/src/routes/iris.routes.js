import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import RankedMatch from '../models/RankedMatch.js';
import StrickerMatch from '../models/StrickerMatch.js';

// ES Module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import IrisUpdate from '../models/IrisUpdate.js';
import IrisWhitelist from '../models/IrisWhitelist.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { verifyIrisSignature, decryptIrisPayload } from '../middleware/iris.security.middleware.js';
import { createIrisScanChannel, sendIrisConnectionStatus, logIrisConnectionStatus, alertIrisMatchDisconnected, sendIrisShadowBan, sendIrisSecurityWarning, sendIrisSecurityChange, sendIrisScreenshots, deleteIrisScanModeChannel, sendIrisExtendedAlert, sendIrisGameMismatchAlert, sendIrisLowActivityAlert, sendIrisUpdateNotification } from '../services/discordBot.service.js';
import fetch from 'node-fetch';

const router = express.Router();

// Helper function to get avatar URL for Iris (with Discord fallback)
const getIrisAvatarUrl = (user) => {
  // Custom uploaded avatar (path starting with /uploads/)
  if (user.avatar && user.avatar.startsWith('/uploads/')) {
    return `${process.env.API_URL || 'https://api-nomercy.ggsecure.io'}${user.avatar}`;
  }
  
  // Already a full URL (http/https) - but not Discord CDN
  if (user.avatar && 
      (user.avatar.startsWith('http://') || user.avatar.startsWith('https://')) && 
      !user.avatar.includes('cdn.discordapp.com')) {
    return user.avatar;
  }
  
  // Fallback to Discord avatar (priority fallback for Iris)
  if (user.discordAvatar && user.discordId) {
    return `https://cdn.discordapp.com/avatars/${user.discordId}/${user.discordAvatar}.png?size=128`;
  }
  
  // No avatar available
  return null;
};

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

// Pending auth sessions (for desktop app polling)
const pendingAuthSessions = new Map();
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
// Runs every minute, checks for players who haven't sent ping in 1+ minute (ping is every 30 sec)
setInterval(async () => {
  try {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    
    // Find ALL users who were connected but haven't sent ping in 1+ minute
    const disconnectedUsers = await User.find({
      irisWasConnected: true,
      irisLastSeen: { $lt: oneMinuteAgo }
    }).select('_id username discordUsername irisScanChannelId irisCurrentSessionId irisSessionHistory irisLastSeen');
    
    for (const user of disconnectedUsers) {
      console.log('[Iris Monitor] Detected disconnection for:', user.username);
      
      // Note: Disconnection status no longer sent to scan channel - only screenshots go there
      
      // Close the current session in history
      const disconnectedAt = new Date();
      const updateData = {
        irisWasConnected: false,
        irisCurrentSessionId: null
      };
      
      // Find and close the open session
      if (user.irisSessionHistory && user.irisSessionHistory.length > 0) {
        const lastSession = user.irisSessionHistory[user.irisSessionHistory.length - 1];
        if (lastSession && !lastSession.disconnectedAt) {
          // Calculate duration in seconds
          const connectedAt = new Date(lastSession.connectedAt);
          const duration = Math.round((disconnectedAt - connectedAt) / 1000);
          
          // Update the last session with disconnection time
          await User.updateOne(
            { _id: user._id, 'irisSessionHistory._id': lastSession._id },
            {
              $set: {
                'irisSessionHistory.$.disconnectedAt': disconnectedAt,
                'irisSessionHistory.$.duration': duration
              }
            }
          );
        }
      }
      
      // Update user to mark as disconnected
      await User.findByIdAndUpdate(user._id, updateData);
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
// Default to production URL, only use localhost if explicitly in development
const DISCORD_REDIRECT_URI = process.env.IRIS_DEV_MODE === 'true'
  ? 'http://localhost:5000/api/iris/discord-callback'
  : 'https://nomercy.ggsecure.io/api/iris/discord-callback';

console.log('[Iris] Discord Redirect URI:', DISCORD_REDIRECT_URI);
console.log('[Iris] Security middleware enabled');
console.log('[Iris] Client authentication enabled');

// Simple health check (no auth required) - for debugging connectivity
router.get('/health', (req, res) => {
  console.log('[Iris Health] Request from:', req.ip);
  res.json({ success: true, status: 'ok', timestamp: Date.now() });
});

// ====== DESKTOP AUTH SESSION ENDPOINTS ======

/**
 * Create auth session for desktop app
 * POST /api/iris/auth/create-session
 */
router.post('/auth/create-session', async (req, res) => {
  try {
    const sessionId = crypto.randomBytes(32).toString('hex');
    
    pendingAuthSessions.set(sessionId, {
      created: Date.now(),
      status: 'pending',
      token: null,
      user: null
    });
    
    // Clean up after 10 minutes
    setTimeout(() => {
      pendingAuthSessions.delete(sessionId);
    }, 10 * 60 * 1000);
    
    console.log('[Iris] Created auth session:', sessionId.substring(0, 8) + '...');
    
    res.json({
      success: true,
      sessionId,
      authUrl: `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20email&state=${sessionId}`
    });
  } catch (error) {
    console.error('[Iris] Create session error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * Check auth session status (polling)
 * GET /api/iris/auth/status/:sessionId
 */
router.get('/auth/status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = pendingAuthSessions.get(sessionId);
    
    if (!session) {
      return res.json({
        success: false,
        status: 'expired',
        message: 'Session expired or not found'
      });
    }
    
    if (session.status === 'completed') {
      // Clean up session after delivering token
      pendingAuthSessions.delete(sessionId);
      
      return res.json({
        success: true,
        status: 'completed',
        token: session.token,
        user: session.user
      });
    }
    
    res.json({
      success: true,
      status: session.status
    });
  } catch (error) {
    console.error('[Iris] Auth status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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
  const { code, state } = req.query;
  
  console.log('[Iris] Discord callback received, code:', code ? 'present' : 'missing', 'state:', state ? state.substring(0, 8) + '...' : 'none');
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

    // Update user last seen and set platform to PC (Iris is PC-only)
    user.irisLastSeen = new Date();
    user.platform = 'PC';
    await user.save();

    // If state (session ID) is provided, store token in session for polling
    if (state && pendingAuthSessions.has(state)) {
      console.log('[Iris] Updating auth session with token');
      pendingAuthSessions.set(state, {
        status: 'completed',
        token: irisToken,
        user: {
          id: user._id,
          username: user.username || discordUser.username,
          discordId: user.discordId,
          avatarUrl: getIrisAvatarUrl(user) || (discordUser.avatar 
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            : null)
        }
      });
    }

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
        avatarUrl: getIrisAvatarUrl(user)
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
        avatarUrl: getIrisAvatarUrl(user),
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
        avatarUrl: getIrisAvatarUrl(user)
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
 * Full reset - Clear ALL Iris data as if player never downloaded Iris (admin only)
 * POST /api/iris/reset/:userId
 */
router.post('/reset/:userId', verifyToken, async (req, res) => {
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

    const username = user.username || user.discordUsername;
    console.log(`[Iris] Full reset requested for ${username} by admin ${req.user.username}`);

    // Delete the scan channel if it exists
    if (user.irisScanChannelId) {
      try {
        const { deleteIrisChannel } = await import('../services/discordBot.service.js');
        await deleteIrisChannel(user.irisScanChannelId, username);
        console.log(`[Iris] Scan channel deleted for ${username}`);
      } catch (err) {
        console.error(`[Iris] Failed to delete scan channel: ${err.message}`);
      }
    }

    // Clear ALL Iris-related fields
    await User.findByIdAndUpdate(user._id, {
      $unset: {
        irisHardwareId: 1,
        irisSystemInfo: 1,
        irisLastSeen: 1,
        irisRegisteredAt: 1,
        irisSecurityStatus: 1,
        irisClientVerified: 1,
        irisClientVersion: 1,
        irisClientCodeHash: 1,
        irisVerifiedAt: 1,
        irisScanChannelId: 1,
        irisCurrentSessionId: 1
      },
      irisScanMode: false,
      irisWasConnected: false,
      irisDetectionHistory: [],
      irisSessionHistory: [],
      irisGameDetection: {
        lastDetected: null,
        gameRunning: false,
        gameName: null,
        gameWindowActive: false,
        mismatchCount: 0,
        lastMismatchAt: null,
        matchActivityTracking: {
          matchId: null,
          matchType: null,
          trackingStartedAt: null,
          totalSamples: 0,
          activeSamples: 0,
          activityPercentage: 0,
          lastActiveAt: null,
          consecutiveInactive: 0,
          lowActivityAlertSent: false
        }
      }
    });

    console.log(`[Iris] Full reset completed for ${username}`);

    res.json({
      success: true,
      message: `Iris data for ${username} has been completely reset`
    });
  } catch (error) {
    console.error('[Iris] Full reset error:', error);
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

    // Get latest version from database
    const latestUpdate = await IrisUpdate.findOne({ isCurrent: true }).sort({ createdAt: -1 });
    const version = latestUpdate?.version || '1.0.0';
    
    // Always use API production URL for downloads (files are on api-nomercy server)
    const API_PROD_URL = 'https://api-nomercy.ggsecure.io';
    
    res.json({
      success: true,
      downloadUrl: `${API_PROD_URL}/iris-downloads/Iris_${version}_x64-setup.exe`,
      version: version,
      fileName: `Iris_${version}_x64-setup.exe`
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
 * Download the Iris installer
 * GET /api/iris/installer
 * Protected by: download token OR valid Iris auth token (for Tauri updates)
 */
router.get('/installer', async (req, res) => {
  try {
    const { token } = req.query;
    const authHeader = req.headers.authorization;
    
    // Method 1: Download token from /download endpoint
    if (token) {
      try {
        const decoded = jwt.verify(token, IRIS_JWT_SECRET);
        if (decoded.purpose !== 'iris_download') {
          return res.status(401).json({
            success: false,
            message: 'Invalid token purpose'
          });
        }
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired download token'
        });
      }
    }
    // Method 2: Iris auth token (for Tauri updater)
    else if (authHeader && authHeader.startsWith('Bearer ')) {
      const irisToken = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(irisToken, IRIS_JWT_SECRET);
        if (decoded.type !== 'iris') {
          return res.status(401).json({
            success: false,
            message: 'Invalid token type'
          });
        }
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: 'Invalid auth token'
        });
      }
    }
    // Method 3: Allow public access for Tauri updater (User-Agent check)
    else {
      // Allow public access - installer is not sensitive, just like website download
      console.log('[Iris] Public download request');
    }

    // Get latest version from update config
    const latestUpdate = await IrisUpdate.findOne({ isCurrent: true }).sort({ createdAt: -1 });
    const version = latestUpdate?.version || '1.0.1';
    const fileName = `Iris_${version}_x64-setup.exe`;
    const installerPath = path.join(__dirname, '../../iris-downloads', fileName);
    
    // Check if file exists
    if (!fs.existsSync(installerPath)) {
      console.error('[Iris] Installer not found:', installerPath);
      return res.status(404).json({
        success: false,
        message: 'Installer not found'
      });
    }
    
    res.download(installerPath, fileName, (err) => {
      if (err) {
        console.error('[Iris] Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Failed to download installer'
          });
        }
      }
    });
  } catch (error) {
    console.error('[Iris] Installer download error:', error);
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
 * Ping - Simple alive signal from Iris client every 2 minutes
 * POST /api/iris/ping
 * Protected by: HMAC signature verification
 * 
 * Only updates irisLastSeen to confirm client is still running
 */
router.post('/ping', verifyIrisSignature, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, IRIS_JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    if (decoded.type !== 'iris') {
      return res.status(401).json({ success: false, message: 'Invalid token type' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if user was previously disconnected (for connection notification)
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    const wasDisconnected = !user.irisWasConnected || 
      (user.irisLastSeen && new Date(user.irisLastSeen) < threeMinutesAgo);

    // Update last seen timestamp and ensure platform is set to PC
    await User.findByIdAndUpdate(user._id, {
      irisLastSeen: new Date(),
      irisWasConnected: true,
      platform: 'PC'
    });

    // Send connection notification if player just reconnected (only to scan channel, not global logs)
    if (wasDisconnected) {
      console.log('[Iris Ping] Player reconnected:', user.username);
      // Note: Connection status no longer sent to scan channel - only screenshots go there
    }

    // Check if immediate screenshots were requested (scan mode just enabled by admin)
    const requestImmediateScreenshots = user.irisScanImmediateRequest || false;
    
    // Clear the immediate request flag after checking (will be sent in response)
    if (requestImmediateScreenshots) {
      await User.findByIdAndUpdate(user._id, { irisScanImmediateRequest: false });
      console.log(`[Iris Ping] Requesting immediate screenshots from ${user.username}`);
    }

    res.json({
      success: true,
      scanModeEnabled: user.irisScanMode || false,
      requestImmediateScreenshots: requestImmediateScreenshots
    });
  } catch (error) {
    console.error('[Iris Ping] Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * Heartbeat - Receive security status from Iris client every 5 minutes
 * POST /api/iris/heartbeat
 * Protected by: HMAC signature verification + encrypted payload support
 * 
 * Includes server-side verification of raw outputs to prevent data falsification
 */
// Increase body limit for heartbeat route (screenshots can be large)
router.post('/heartbeat', express.json({ limit: '50mb' }), (req, res, next) => {
  console.log('[Iris Heartbeat] Request received, body size:', JSON.stringify(req.body).length, 'bytes');
  next();
}, verifyIrisSignature, decryptIrisPayload, async (req, res) => {
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
    
    // Normalize security data to handle both old and new Iris client formats
    const normalizedSecurity = {
      // TPM - handle both {enabled: bool} and {tpm: {enabled: bool}}
      tpm: security.tpm || { enabled: false, present: false, version: 'N/A' },
      // Secure Boot - handle both secureBoot (new) and secure_boot (old)
      secureBoot: security.secureBoot ?? security.secure_boot?.enabled ?? false,
      // Virtualization - handle both direct bool and nested object
      virtualization: security.virtualization ?? security.virtualization?.enabled ?? false,
      // IOMMU - handle both direct bool and nested in virtualization
      iommu: security.iommu ?? security.virtualization?.iommu ?? false,
      // DMA Protection - handle both direct bool and nested in virtualization
      kernelDmaProtection: security.kernelDmaProtection ?? security.virtualization?.kernel_dma_protection ?? false,
      // VBS - handle both direct bool and nested object
      vbs: security.vbs ?? security.vbs?.enabled ?? false,
      // HVCI - handle both direct bool and nested in vbs
      hvci: security.hvci ?? security.vbs?.hvci_enabled ?? false,
      // Defender - handle both direct bool and nested object
      defender: security.defender ?? security.defender?.enabled ?? false,
      // Defender Realtime - handle both direct bool and nested in defender
      defenderRealtime: security.defenderRealtime ?? security.defender?.real_time_protection ?? false
    };
    
    console.log('[Iris Heartbeat] Security data normalized for', user.username, ':', JSON.stringify(normalizedSecurity));
    
    // Check if user was previously disconnected (for connection notification)
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    const wasDisconnected = !user.irisWasConnected || 
      (user.irisLastSeen && new Date(user.irisLastSeen) < threeMinutesAgo);
    
    await User.findByIdAndUpdate(user._id, {
      irisLastSeen: new Date(),
      irisWasConnected: true,
      irisSecurityStatus: {
        ...normalizedSecurity,
        // Process and device info (from systemInfo)
        processes: systemInfo?.processes || [],
        usbDevices: systemInfo?.usbDevices || [],
        cheatDetection: systemInfo?.cheatDetection || { found: false, devices: [], processes: [], warnings: [] },
        // New detection modules
        networkMonitor: systemInfo?.networkMonitor || { vpnDetected: false, proxyDetected: false, vpnAdapters: [], vpnProcesses: [], riskScore: 0 },
        registryScan: systemInfo?.registryScan || { tracesFound: false, traces: [], riskScore: 0 },
        driverIntegrity: systemInfo?.driverIntegrity || { suspiciousFound: false, suspiciousDrivers: [], riskScore: 0 },
        macroDetection: systemInfo?.macroDetection || { macrosDetected: false, detectedSoftware: [], riskScore: 0 },
        overlayDetection: systemInfo?.overlayDetection || { overlaysFound: false, suspiciousOverlays: [], riskScore: 0 },
        dllInjection: systemInfo?.dllInjection || { injectionDetected: false, suspiciousDlls: [], riskScore: 0 },
        vmDetection: systemInfo?.vmDetection || { vmDetected: false, vmType: null, vmIndicators: [], riskScore: 0 },
        cloudPcDetection: systemInfo?.cloudPcDetection || { cloudPcDetected: false, cloudProvider: null, cloudIndicators: [], isGamingCloud: false, riskScore: 0 },
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
      
      // First, close any previous open session (in case disconnect wasn't detected)
      if (user.irisSessionHistory && user.irisSessionHistory.length > 0) {
        const lastSession = user.irisSessionHistory[user.irisSessionHistory.length - 1];
        if (lastSession && !lastSession.disconnectedAt) {
          // Close the previous session with estimated disconnect time (last seen + 1 min)
          const estimatedDisconnect = new Date(user.irisLastSeen?.getTime() + 60000 || Date.now() - 60000);
          const connectedAt = new Date(lastSession.connectedAt);
          const duration = Math.round((estimatedDisconnect - connectedAt) / 1000);
          
          await User.updateOne(
            { _id: user._id, 'irisSessionHistory._id': lastSession._id },
            {
              $set: {
                'irisSessionHistory.$.disconnectedAt': estimatedDisconnect,
                'irisSessionHistory.$.duration': duration
              }
            }
          );
          console.log('[Iris Heartbeat] Closed previous session for', user.username, '- Duration:', duration, 's');
        }
      }
      
      // Create a new session entry in history
      const newSession = {
        _id: new mongoose.Types.ObjectId(),
        connectedAt: new Date(),
        disconnectedAt: null,
        duration: null,
        clientVersion: req.body.clientVersion || user.irisClientVersion || 'unknown',
        hardwareId: hardwareId
      };
      
      // Add to session history (keep last 50 sessions)
      await User.findByIdAndUpdate(user._id, {
        $push: {
          irisSessionHistory: {
            $each: [newSession],
            $slice: -50 // Keep only last 50 sessions
          }
        },
        irisCurrentSessionId: newSession._id
      });
      
      console.log('[Iris Heartbeat] New session created for', user.username, '- Session ID:', newSession._id);
      
      // Note: Connection status no longer sent to scan channel - only screenshots go there
    }

    // ====== GAME SESSION MISMATCH DETECTION (Anti-Bypass) ======
    // Detect if player is in a match but game is NOT running on their Iris machine
    // This indicates potential bypass attempt (Iris running on a different PC than the game)
    const gameDetection = systemInfo?.gameDetection;
    const gameRunning = gameDetection?.gameRunning || false;
    
    // Check if user is currently in an active Ranked or Stricker match
    const activeRankedMatch = await RankedMatch.findOne({
      $or: [
        { 'team1.players': user._id },
        { 'team2.players': user._id }
      ],
      status: 'in_progress'
    });
    
    const activeStrickerMatch = await StrickerMatch.findOne({
      players: user._id,
      status: 'in_progress'
    });
    
    // Update user's game detection status
    if (gameDetection) {
      await User.findByIdAndUpdate(user._id, {
        'irisGameDetection.lastDetected': new Date(),
        'irisGameDetection.gameRunning': gameRunning,
        'irisGameDetection.gameName': gameDetection.gameName || null,
        'irisGameDetection.gameWindowActive': gameDetection.gameWindowActive || false
      });
    }
    
    // MISMATCH DETECTION: Player is in match but game not detected on Iris machine
    if ((activeRankedMatch || activeStrickerMatch) && !gameRunning) {
      // Increment mismatch count for tracking repeat offenders
      const currentMismatchCount = user.irisGameDetection?.mismatchCount || 0;
      const newMismatchCount = currentMismatchCount + 1;
      
      await User.findByIdAndUpdate(user._id, {
        'irisGameDetection.mismatchCount': newMismatchCount,
        'irisGameDetection.lastMismatchAt': new Date()
      });
      
      // Only alert after 2 consecutive mismatches (avoid false positives during game loading)
      if (newMismatchCount >= 2) {
        console.warn('[Iris Heartbeat] GAME MISMATCH DETECTED:', user.username, 
          '- In match but game NOT detected on Iris machine! (count:', newMismatchCount, ')');
        
        const matchType = activeRankedMatch ? 'ranked' : 'stricker';
        const matchId = activeRankedMatch?._id || activeStrickerMatch?._id;
        
        // Send Discord alert
        sendIrisGameMismatchAlert(
          { 
            username: user.username, 
            discordUsername: user.discordUsername, 
            discordId: user.discordId 
          },
          {
            matchType,
            matchId,
            irisConnected: true,
            gameDetected: false,
            hardwareId: hardwareId,
            mismatchCount: newMismatchCount
          }
        ).catch(err => console.error('[Iris Heartbeat] Game mismatch alert error:', err.message));
      } else {
        console.log('[Iris Heartbeat] Game mismatch for', user.username, '- count:', newMismatchCount, '(waiting for 2+ to alert)');
      }
    } else if (gameRunning) {
      // Reset mismatch count when game is detected
      if (user.irisGameDetection?.mismatchCount > 0) {
        await User.findByIdAndUpdate(user._id, {
          'irisGameDetection.mismatchCount': 0
        });
      }
    }
    
    // ====== WINDOW ACTIVITY TRACKING DURING MATCHES ======
    // Track % of time the game window is active during an active match
    // Alerts if activity is suspiciously low (player launched game but isn't actually playing)
    const gameWindowActive = gameDetection?.gameWindowActive || false;
    const currentMatchId = activeRankedMatch?._id || activeStrickerMatch?._id;
    const currentMatchType = activeRankedMatch ? 'ranked' : (activeStrickerMatch ? 'stricker' : null);
    const trackingData = user.irisGameDetection?.matchActivityTracking || {};
    
    if ((activeRankedMatch || activeStrickerMatch) && gameRunning) {
      // Player is in match AND game is running - track window activity
      const isNewMatch = !trackingData.matchId || trackingData.matchId.toString() !== currentMatchId.toString();
      
      if (isNewMatch) {
        // Start tracking for new match
        console.log('[Iris Heartbeat] Starting window activity tracking for', user.username, 'in', currentMatchType, 'match');
        await User.findByIdAndUpdate(user._id, {
          'irisGameDetection.matchActivityTracking': {
            matchId: currentMatchId,
            matchType: currentMatchType,
            trackingStartedAt: new Date(),
            totalSamples: 1,
            activeSamples: gameWindowActive ? 1 : 0,
            activityPercentage: gameWindowActive ? 100 : 0,
            lastActiveAt: gameWindowActive ? new Date() : null,
            consecutiveInactive: gameWindowActive ? 0 : 1,
            lowActivityAlertSent: false
          }
        });
      } else {
        // Update existing tracking
        const newTotalSamples = (trackingData.totalSamples || 0) + 1;
        const newActiveSamples = (trackingData.activeSamples || 0) + (gameWindowActive ? 1 : 0);
        const newActivityPercentage = Math.round((newActiveSamples / newTotalSamples) * 100);
        const newConsecutiveInactive = gameWindowActive ? 0 : (trackingData.consecutiveInactive || 0) + 1;
        
        await User.findByIdAndUpdate(user._id, {
          'irisGameDetection.matchActivityTracking.totalSamples': newTotalSamples,
          'irisGameDetection.matchActivityTracking.activeSamples': newActiveSamples,
          'irisGameDetection.matchActivityTracking.activityPercentage': newActivityPercentage,
          'irisGameDetection.matchActivityTracking.lastActiveAt': gameWindowActive ? new Date() : trackingData.lastActiveAt,
          'irisGameDetection.matchActivityTracking.consecutiveInactive': newConsecutiveInactive
        });
        
        // Check for suspicious low activity (< 30% after at least 4 samples = 2+ minutes of match)
        // This catches the bypass where player launches game but leaves it in menu/background
        const MIN_SAMPLES_FOR_ALERT = 4; // ~2 minutes (30 sec heartbeat intervals)
        const LOW_ACTIVITY_THRESHOLD = 30; // Alert if activity < 30%
        
        if (newTotalSamples >= MIN_SAMPLES_FOR_ALERT && 
            newActivityPercentage < LOW_ACTIVITY_THRESHOLD && 
            !trackingData.lowActivityAlertSent) {
          
          console.warn('[Iris Heartbeat] LOW WINDOW ACTIVITY DETECTED:', user.username,
            '- Activity:', newActivityPercentage + '%, samples:', newTotalSamples,
            '- Game running but window rarely active!');
          
          // Mark alert as sent to prevent spam
          await User.findByIdAndUpdate(user._id, {
            'irisGameDetection.matchActivityTracking.lowActivityAlertSent': true
          });
          
          // Send Discord alert for low activity
          sendIrisLowActivityAlert(
            {
              username: user.username,
              discordUsername: user.discordUsername,
              discordId: user.discordId
            },
            {
              matchType: currentMatchType,
              matchId: currentMatchId,
              activityPercentage: newActivityPercentage,
              totalSamples: newTotalSamples,
              activeSamples: newActiveSamples,
              consecutiveInactive: newConsecutiveInactive,
              hardwareId: hardwareId
            }
          ).catch(err => console.error('[Iris Heartbeat] Low activity alert error:', err.message));
        }
        
        console.log('[Iris Heartbeat] Window activity for', user.username, ':',
          newActivityPercentage + '%', '(' + newActiveSamples + '/' + newTotalSamples + ' samples)');
      }
    } else if (!activeRankedMatch && !activeStrickerMatch && trackingData.matchId) {
      // Match ended - clear tracking
      console.log('[Iris Heartbeat] Match ended, clearing activity tracking for', user.username);
      await User.findByIdAndUpdate(user._id, {
        'irisGameDetection.matchActivityTracking': {
          matchId: null,
          matchType: null,
          trackingStartedAt: null,
          totalSamples: 0,
          activeSamples: 0,
          activityPercentage: 0,
          lastActiveAt: null,
          consecutiveInactive: 0,
          lowActivityAlertSent: false
        }
      });
    }

    // ====== SECURITY STATE CHANGE DETECTION ======
    // Check if client sent security changes (detected between heartbeats)
    // Client sends this in systemInfo.securityChanges
    const securityChanges = systemInfo?.securityChanges || req.body.securityChanges;
    
    if (securityChanges && Array.isArray(securityChanges) && securityChanges.length > 0) {
      console.warn('[Iris Heartbeat] Security state changed for', user.username, ':', securityChanges);
      
      // Send notification to security changes channel
      await sendIrisSecurityChange(
        {
          username: user.username,
          discordUsername: user.discordUsername,
          discordId: user.discordId
        },
        securityChanges
      ).catch(err => console.error('[Iris Heartbeat] Security change notification error:', err.message));
      
      // Note: Security changes no longer sent to scan channel - only screenshots go there
    }
    
    // ====== SECURITY MONITORING (NON-SCAN MODE ONLY) ======
    // When scan mode is NOT active:
    // - On connection: check ALL modules, alert if any missing to channel 1468857779547803733
    // - During session: monitor only Defender/HVCI changes, alert to same channel
    // When scan mode IS active: all data goes to player's scan channel with screenshots
    
    if (!user.irisScanMode) {
      // ====== SERVER-SIDE HVCI/DEFENDER CHANGE DETECTION ======
      // Monitor HVCI (kernel isolation) and Defender status changes during session
      if (security && !wasDisconnected) {
        const previousHvci = user.irisSecurityStatus?.lastHvci;
        const previousDefender = user.irisSecurityStatus?.lastDefender;
        const previousDefenderRealtime = user.irisSecurityStatus?.lastDefenderRealtime;
        
        const currentHvci = security.hvci || false;
        const currentDefender = security.defender || false;
        const currentDefenderRealtime = security.defenderRealtime || false;
        
        const hvciDefenderChanges = [];
        
        // Check HVCI change
        if (previousHvci !== undefined && previousHvci !== currentHvci) {
          hvciDefenderChanges.push(`HVCI (Isolation du noyau): ${previousHvci ? '✅ Activé' : '❌ Désactivé'} → ${currentHvci ? '✅ Activé' : '❌ Désactivé'}`);
        }
        
        // Check Defender change
        if (previousDefender !== undefined && previousDefender !== currentDefender) {
          hvciDefenderChanges.push(`Windows Defender: ${previousDefender ? '✅ Activé' : '❌ Désactivé'} → ${currentDefender ? '✅ Activé' : '❌ Désactivé'}`);
        }
        
        // Check Defender Realtime change
        if (previousDefenderRealtime !== undefined && previousDefenderRealtime !== currentDefenderRealtime) {
          hvciDefenderChanges.push(`Defender Temps Réel: ${previousDefenderRealtime ? '✅ Activé' : '❌ Désactivé'} → ${currentDefenderRealtime ? '✅ Activé' : '❌ Désactivé'}`);
        }
        
        // Send notification if HVCI or Defender changed
        if (hvciDefenderChanges.length > 0) {
          console.warn('[Iris Heartbeat] HVCI/Defender changed for', user.username, ':', hvciDefenderChanges);
          
          await sendIrisSecurityChange(
            {
              username: user.username,
              discordUsername: user.discordUsername,
              discordId: user.discordId
            },
            hvciDefenderChanges
          ).catch(err => console.error('[Iris Heartbeat] HVCI/Defender change notification error:', err.message));
        }
        
        // Update stored HVCI/Defender state
        await User.findByIdAndUpdate(user._id, {
          'irisSecurityStatus.lastHvci': currentHvci,
          'irisSecurityStatus.lastDefender': currentDefender,
          'irisSecurityStatus.lastDefenderRealtime': currentDefenderRealtime
        });
      }
      
      // ====== INITIAL CONNECTION: CHECK ALL MODULES ======
      // When player connects, check ALL security modules and report missing ones
      if (wasDisconnected && security) {
        const missingModulesOnConnection = [];
        
        // Check TPM
        if (!security.tpm?.enabled && !security.tpm?.present) {
          missingModulesOnConnection.push({ name: 'TPM', status: 'Désactivé ou non présent' });
        }
        
        // Check Secure Boot
        if (!security.secureBoot) {
          missingModulesOnConnection.push({ name: 'Secure Boot', status: 'Désactivé' });
        }
        
        // Check Virtualization (VT-x/AMD-V)
        if (!security.virtualization) {
          missingModulesOnConnection.push({ name: 'Virtualization', status: 'Désactivé (VT-x/AMD-V)' });
        }
        
        // Check IOMMU (VT-d)
        if (!security.iommu) {
          missingModulesOnConnection.push({ name: 'IOMMU', status: 'Désactivé (VT-d/AMD-Vi)' });
        }
        
        // CRITICAL: Check Kernel DMA Protection (blocks DMA cheats)
        // IOMMU present doesn't mean DMA is blocked - Kernel DMA Protection enforces it
        if (!security.kernelDmaProtection) {
          if (security.iommu) {
            // WARNING: IOMMU is on but not enforced - DMA cheats CAN work!
            missingModulesOnConnection.push({ 
              name: 'Kernel DMA Protection', 
              status: '⚠️ CRITIQUE: IOMMU présent mais NON APPLIQUÉ - Vulnérable aux DMA cheats!' 
            });
          } else {
            missingModulesOnConnection.push({ 
              name: 'Kernel DMA Protection', 
              status: 'Désactivé (Protection DMA)' 
            });
          }
        }
        
        // Check VBS
        if (!security.vbs) {
          missingModulesOnConnection.push({ name: 'VBS', status: 'Désactivé' });
        }
        
        // Check HVCI (Kernel Isolation)
        if (!security.hvci) {
          missingModulesOnConnection.push({ name: 'HVCI', status: 'Désactivé (Isolation du noyau)' });
        }
        
        // Check Windows Defender
        if (!security.defender) {
          missingModulesOnConnection.push({ name: 'Defender', status: 'Désactivé' });
        }
        
        // Check Defender Realtime Protection
        if (!security.defenderRealtime) {
          missingModulesOnConnection.push({ name: 'Defender RT', status: 'Protection temps réel désactivée' });
        }
        
        // Send notification if any modules are missing
        if (missingModulesOnConnection.length > 0) {
          console.warn(`[Iris Heartbeat] Missing modules on connection for ${user.username}:`, 
            missingModulesOnConnection.map(m => m.name).join(', '));
          
          await sendIrisSecurityWarning(
            {
              username: user.username,
              discordUsername: user.discordUsername,
              discordId: user.discordId
            },
            missingModulesOnConnection
          ).catch(err => console.error('[Iris Heartbeat] Missing modules notification error:', err.message));
        }
        
        // Store initial HVCI/Defender state for change detection
        await User.findByIdAndUpdate(user._id, {
          'irisSecurityStatus.lastHvci': security.hvci || false,
          'irisSecurityStatus.lastDefender': security.defender || false,
          'irisSecurityStatus.lastDefenderRealtime': security.defenderRealtime || false
        });
      }
    }

    // ====== SEND RESPONSE FIRST (avoid timeout) ======
    // Send response immediately, then process Discord notifications asynchronously
    console.log('[Iris Heartbeat] Received from:', user.username, 
      '| Verified:', verificationResult.verified,
      '| Tamper:', verificationResult.tamperDetected,
      '| Clean:', antiTamperResult.clean
    );

    // Check if immediate screenshots were requested (scan mode just enabled by admin)
    const requestImmediateScreenshots = (wasDisconnected && user.irisScanMode) || user.irisScanImmediateRequest;
    
    // Clear the immediate request flag if it was set
    if (user.irisScanImmediateRequest) {
      User.findByIdAndUpdate(user._id, { irisScanImmediateRequest: false }).catch(err => 
        console.error('[Iris Heartbeat] Error clearing immediate request flag:', err.message)
      );
      console.log(`[Iris Heartbeat] Requesting immediate screenshots from ${user.username}`);
    }

    res.json({
      success: true,
      message: 'Heartbeat received',
      verified: verificationResult.verified,
      tamperDetected: verificationResult.tamperDetected,
      scanModeEnabled: user.irisScanMode || false,
      requestImmediateScreenshots: requestImmediateScreenshots
    });

    // ====== ASYNC PROCESSING (after response sent) ======
    // Process screenshots and alerts in background to avoid blocking
    const screenshots = systemInfo?.screenshots;
    
    // Debug logging for scan mode
    console.log(`[Iris Heartbeat] Scan check for ${user.username}: scanMode=${user.irisScanMode}, channelId=${user.irisScanChannelId}, screenshots=${screenshots?.length || 0}`);
    
    if (screenshots && Array.isArray(screenshots) && screenshots.length > 0 && user.irisScanChannelId) {
      console.log(`[Iris Heartbeat] Sending ${screenshots.length} screenshot(s) to Discord channel ${user.irisScanChannelId}`);
      
      // Send screenshots asynchronously (don't await)
      sendIrisScreenshots(
        user.irisScanChannelId,
        { username: user.username, discordUsername: user.discordUsername },
        screenshots
      ).then(result => {
        console.log(`[Iris Heartbeat] Screenshot send result:`, result);
      }).catch(err => {
        console.error('[Iris Heartbeat] Screenshot send error:', err.message);
      });
    } else if (user.irisScanMode && !user.irisScanChannelId) {
      console.log(`[Iris Heartbeat] Scan mode active for ${user.username} but NO CHANNEL ID`);
    }

    // ====== WHITELIST FILTERING HELPER (defined early for all detections) ======
    // Filter out whitelisted items from detection arrays
    const filterWhitelisted = async (type, items, identifierField = 'name') => {
      if (!items || items.length === 0) return items;
      try {
        const whitelist = await IrisWhitelist.find({ type, isActive: true }).lean();
        if (whitelist.length === 0) return items;
        const whitelistSet = new Set(whitelist.map(w => w.identifier.toLowerCase()));
        return items.filter(item => {
          const identifier = item[identifierField]?.toLowerCase();
          if (!identifier) return true; // Keep items without identifier
          return !whitelistSet.has(identifier);
        });
      } catch (err) {
        console.error(`[Iris Whitelist] Filter error for ${type}:`, err.message);
        return items; // On error, don't filter
      }
    };
    
    // Filter string arrays (for VPN adapters, processes, etc.)
    const filterWhitelistedStrings = async (type, items) => {
      if (!items || items.length === 0) return items;
      try {
        const whitelist = await IrisWhitelist.find({ type, isActive: true }).lean();
        if (whitelist.length === 0) return items;
        const whitelistSet = new Set(whitelist.map(w => w.identifier.toLowerCase()));
        return items.filter(item => !whitelistSet.has(item.toLowerCase()));
      } catch (err) {
        console.error(`[Iris Whitelist] String filter error for ${type}:`, err.message);
        return items;
      }
    };
    
    // Filter USB devices by VID:PID or device name
    const filterWhitelistedDevices = async (devices) => {
      if (!devices || devices.length === 0) return devices;
      try {
        const whitelist = await IrisWhitelist.find({ type: 'usb_device', isActive: true }).lean();
        if (whitelist.length === 0) return devices;
        const whitelistSet = new Set(whitelist.map(w => w.identifier.toLowerCase()));
        return devices.filter(device => {
          // Check VID:PID format
          if (device.vid && device.pid) {
            const vidPid = `${device.vid}:${device.pid}`.toLowerCase();
            if (whitelistSet.has(vidPid)) return false;
          }
          // Check device name
          const deviceName = (device.deviceType || device.name || '').toLowerCase();
          if (deviceName && whitelistSet.has(deviceName)) return false;
          return true;
        });
      } catch (err) {
        console.error(`[Iris Whitelist] Device filter error:`, err.message);
        return devices;
      }
    };

    // Log cheat detection and send alert (no shadow ban) - ASYNC with whitelist filtering
    if (systemInfo?.cheatDetection?.found) {
      // Filter whitelisted processes and devices
      const filteredProcesses = await filterWhitelisted('process', systemInfo.cheatDetection.processes, 'name');
      const filteredDevices = await filterWhitelistedDevices(systemInfo.cheatDetection.devices);
      
      // Only proceed if there are non-whitelisted detections
      if (filteredProcesses.length > 0 || filteredDevices.length > 0) {
        console.warn('[Iris Heartbeat] CHEAT DEVICE DETECTED for', user.username);
        
        // Save to detection history (async, no await needed)
        const detections = [];
        if (filteredDevices?.length > 0) {
          for (const device of filteredDevices) {
            detections.push({
              detectedAt: new Date(),
              type: 'cheat_device',
              name: device.deviceType || device.name,
              details: `VID: ${device.vid || 'N/A'}, PID: ${device.pid || 'N/A'}`,
              riskLevel: systemInfo.cheatDetection.riskLevel || 'high',
              riskScore: 100
            });
          }
        }
        if (filteredProcesses?.length > 0) {
          for (const proc of filteredProcesses) {
            detections.push({
              detectedAt: new Date(),
              type: 'cheat_process',
              name: proc.matchedCheat || proc.name,
              details: `Process: ${proc.name}, PID: ${proc.pid}`,
              riskLevel: systemInfo.cheatDetection.riskLevel || 'high',
              riskScore: 75
            });
          }
        }
        if (detections.length > 0) {
          User.findByIdAndUpdate(user._id, {
            $push: { irisDetectionHistory: { $each: detections, $slice: -100 } }
          }).catch(err => console.error('[Iris] Detection history save error:', err.message));
        }
        
        // Send detection alert - ASYNC (no await)
        sendIrisExtendedAlert(
          { username: user.username, discordUsername: user.discordUsername, discordId: user.discordId },
          'cheat',
          { ...systemInfo.cheatDetection, processes: filteredProcesses, devices: filteredDevices, found: true }
        ).catch(err => console.error('[Iris Heartbeat] Cheat detection alert error:', err.message));
      }
    }

    // ====== NEW DETECTION MODULES PROCESSING (ALL ASYNC) ======
    
    // 1. Network Monitor (VPN/Proxy detection)
    const networkMonitor = systemInfo?.networkMonitor;
    if (networkMonitor && (networkMonitor.vpnDetected || networkMonitor.proxyDetected)) {
      // Filter whitelisted VPN adapters and processes
      const filteredAdapters = await filterWhitelistedStrings('vpn_adapter', networkMonitor.vpnAdapters);
      const filteredProcesses = await filterWhitelistedStrings('vpn_process', networkMonitor.vpnProcesses);
      
      // Only alert if there are non-whitelisted items remaining
      if (filteredAdapters.length > 0 || filteredProcesses.length > 0) {
        console.warn('[Iris Heartbeat] NETWORK ALERT for', user.username);
        sendIrisExtendedAlert(
          { username: user.username, discordUsername: user.discordUsername, discordId: user.discordId },
          'network',
          { ...networkMonitor, vpnAdapters: filteredAdapters, vpnProcesses: filteredProcesses }
        ).catch(err => console.error('[Iris Heartbeat] Network alert error:', err.message));
      }
    }
    
    // 2. Registry Scan (cheat traces)
    const registryScan = systemInfo?.registryScan;
    if (registryScan && registryScan.tracesFound) {
      const filteredTraces = await filterWhitelisted('registry', registryScan.traces, 'cheatName');
      
      if (filteredTraces.length > 0) {
        console.warn('[Iris Heartbeat] REGISTRY TRACES for', user.username);
        sendIrisExtendedAlert(
          { username: user.username, discordUsername: user.discordUsername, discordId: user.discordId },
          'registry',
          { ...registryScan, traces: filteredTraces, tracesFound: filteredTraces.length > 0 }
        ).catch(err => console.error('[Iris Heartbeat] Registry alert error:', err.message));
      }
    }
    
    // 3. Driver Integrity (suspicious drivers)
    const driverIntegrity = systemInfo?.driverIntegrity;
    if (driverIntegrity && driverIntegrity.suspiciousFound) {
      const filteredDrivers = await filterWhitelisted('driver', driverIntegrity.suspiciousDrivers, 'name');
      
      if (filteredDrivers.length > 0) {
        console.warn('[Iris Heartbeat] SUSPICIOUS DRIVERS for', user.username);
        sendIrisExtendedAlert(
          { username: user.username, discordUsername: user.discordUsername, discordId: user.discordId },
          'driver',
          { ...driverIntegrity, suspiciousDrivers: filteredDrivers, suspiciousFound: filteredDrivers.length > 0 }
        ).catch(err => console.error('[Iris Heartbeat] Driver alert error:', err.message));
      }
    }
    
    // 4. Macro Detection
    const macroDetection = systemInfo?.macroDetection;
    if (macroDetection && macroDetection.macrosDetected) {
      // Filter whitelisted macros
      const filteredMacros = await filterWhitelisted('macro', macroDetection.detectedSoftware, 'name');
      
      const highRiskMacros = filteredMacros?.filter(
        m => m.macroType === 'ahk' || m.macroType === 'generic'
      ) || [];
      
      // Save ALL detected macros to history (non-whitelisted only)
      if (filteredMacros?.length > 0) {
        const macroDetections = filteredMacros.map(m => ({
          detectedAt: new Date(),
          type: 'macro',
          name: m.name,
          details: `Type: ${m.macroType}, Source: ${m.source}`,
          riskLevel: (m.macroType === 'ahk' || m.macroType === 'generic') ? 'high' : 'medium',
          riskScore: (m.macroType === 'ahk' || m.macroType === 'generic') ? 75 : 40
        }));
        User.findByIdAndUpdate(user._id, {
          $push: { irisDetectionHistory: { $each: macroDetections, $slice: -100 } }
        }).catch(err => console.error('[Iris] Macro history save error:', err.message));
      }
      
      if (highRiskMacros.length > 0) {
        console.warn('[Iris Heartbeat] MACRO DETECTED for', user.username);
        sendIrisExtendedAlert(
          { username: user.username, discordUsername: user.discordUsername, discordId: user.discordId },
          'macro',
          { ...macroDetection, detectedSoftware: filteredMacros, highRiskMacros }
        ).catch(err => console.error('[Iris Heartbeat] Macro alert error:', err.message));
      }
    }
    
    // 5. Overlay Detection
    const overlayDetection = systemInfo?.overlayDetection;
    if (overlayDetection && overlayDetection.overlaysFound) {
      // Filter whitelisted overlays
      const filteredOverlays = await filterWhitelisted('overlay', overlayDetection.suspiciousOverlays, 'processName');
      
      const highRiskOverlays = filteredOverlays?.filter(
        o => o.reason === 'cheat_process' || o.reason === 'suspicious_class'
      ) || [];
      
      if (highRiskOverlays.length > 0) {
        console.warn('[Iris Heartbeat] OVERLAY DETECTED for', user.username);
        sendIrisExtendedAlert(
          { username: user.username, discordUsername: user.discordUsername, discordId: user.discordId },
          'overlay',
          { ...overlayDetection, suspiciousOverlays: filteredOverlays, highRiskOverlays }
        ).catch(err => console.error('[Iris Heartbeat] Overlay alert error:', err.message));
      }
    }
    
    // 6. DLL Injection Detection
    const dllInjection = systemInfo?.dllInjection;
    if (dllInjection && dllInjection.injectionDetected) {
      // Filter whitelisted DLLs
      const filteredDlls = await filterWhitelisted('dll', dllInjection.suspiciousDlls, 'name');
      
      if (filteredDlls.length > 0) {
        console.warn('[Iris Heartbeat] DLL INJECTION for', user.username);
        sendIrisExtendedAlert(
          { username: user.username, discordUsername: user.discordUsername, discordId: user.discordId },
          'dll_injection',
          { ...dllInjection, suspiciousDlls: filteredDlls, injectionDetected: filteredDlls.length > 0 }
        ).catch(err => console.error('[Iris Heartbeat] DLL injection alert error:', err.message));
      }
    }
    
    // 7. VM Detection (no whitelist - VM detection is binary)
    const vmDetection = systemInfo?.vmDetection;
    if (vmDetection && vmDetection.vmDetected) {
      console.warn('[Iris Heartbeat] VM DETECTED for', user.username);
      sendIrisExtendedAlert(
        { username: user.username, discordUsername: user.discordUsername, discordId: user.discordId },
        'vm',
        vmDetection
      ).catch(err => console.error('[Iris Heartbeat] VM detection alert error:', err.message));
    }
    
    // 8. Cloud PC Detection (no whitelist - Cloud PC detection is binary)
    const cloudPcDetection = systemInfo?.cloudPcDetection;
    if (cloudPcDetection && cloudPcDetection.cloudPcDetected) {
      console.warn('[Iris Heartbeat] CLOUD PC DETECTED for', user.username);
      sendIrisExtendedAlert(
        { username: user.username, discordUsername: user.discordUsername, discordId: user.discordId },
        'cloud_pc',
        cloudPcDetection
      ).catch(err => console.error('[Iris Heartbeat] Cloud PC detection alert error:', err.message));
    }
    
    // 9. Cheat Window/Panel Detection (CoD specific)
    const cheatWindowDetection = systemInfo?.cheatWindowDetection;
    if (cheatWindowDetection && cheatWindowDetection.cheatsFound) {
      // Filter whitelisted cheat windows
      const filteredWindows = await filterWhitelisted('cheat_window', cheatWindowDetection.detectedWindows, 'matchedCheat');
      
      if (filteredWindows.length > 0) {
        console.warn('[Iris Heartbeat] CHEAT WINDOW DETECTED for', user.username);
        
        // Save to detection history (async) - filtered only
        const windowDetections = filteredWindows.map(w => ({
          detectedAt: new Date(),
          type: 'cheat_window',
          name: w.matchedCheat,
          details: `Window: ${w.windowTitle?.substring(0, 50)}, Process: ${w.processName || 'N/A'}`,
          riskLevel: w.riskLevel || 'high',
          riskScore: w.riskLevel === 'critical' ? 100 : w.riskLevel === 'high' ? 75 : 40
        }));
        User.findByIdAndUpdate(user._id, {
          $push: { irisDetectionHistory: { $each: windowDetections, $slice: -100 } }
        }).catch(err => console.error('[Iris] Cheat window history save error:', err.message));
        
        sendIrisExtendedAlert(
          { username: user.username, discordUsername: user.discordUsername, discordId: user.discordId },
          'cheat_window',
          { ...cheatWindowDetection, detectedWindows: filteredWindows, cheatsFound: filteredWindows.length > 0 }
        ).catch(err => console.error('[Iris Heartbeat] Cheat window alert error:', err.message));
      }
    }

    // Response already sent above
  } catch (error) {
    console.error('[Iris Heartbeat] Error:', error);
    // Only send error response if headers not already sent
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
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

    // Get only users with PC platform configured
    // Consider connected if last seen within 3 minutes (ping is every 2 min)
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    
    // Build query: Only PC platform users
    const query = { platform: 'PC' };

    // Add search filter if provided
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { username: searchRegex },
        { discordUsername: searchRegex },
        { activisionId: searchRegex }
      ];
    }
    
    const players = await User.find(query)
      .select('username avatar discordAvatar discordUsername discordId platform activisionId createdAt irisLastSeen irisSecurityStatus irisHardwareId irisRegisteredAt irisScanMode irisScanChannelId irisSystemInfo irisClientVersion irisClientVerified isBanned banReason irisSessionHistory irisDetectionHistory')
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
      isConnected: player.irisLastSeen && new Date(player.irisLastSeen) > threeMinutesAgo,
      hasIrisData: !!player.irisLastSeen,
      security: player.irisSecurityStatus || null,
      hardwareId: player.irisHardwareId,
      scanMode: player.irisScanMode || false,
      hasScanChannel: !!player.irisScanChannelId,
      systemInfo: player.irisSystemInfo || null,
      clientVersion: player.irisClientVersion || null,
      clientVerified: player.irisClientVerified || false,
      isBanned: player.isBanned || false,
      banReason: player.banReason || null,
      sessionHistory: player.irisSessionHistory ? player.irisSessionHistory.slice(-20) : [],
      detectionHistory: player.irisDetectionHistory ? player.irisDetectionHistory.slice(-50) : []
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
      downloadUrl, 
      fileSize, 
      changelog, 
      mandatory, 
      isCurrent,
      platform,
      signature
    } = req.body;
    
    // Validate required fields (simplified - only version and URL needed)
    if (!version || !downloadUrl) {
      return res.status(400).json({
        success: false,
        message: 'Version et URL de téléchargement sont requis'
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
      downloadUrl,
      fileSize: fileSize || 0,
      changelog: changelog || '',
      mandatory: mandatory || false,
      isCurrent: isCurrent || false,
      platform: platform || 'windows',
      signature: signature || '',
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
      'downloadUrl', 'fileSize', 'changelog', 
      'mandatory', 'isCurrent', 'isActive', 'signature'
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
    
    // Send Discord notification about the new update
    await sendIrisUpdateNotification({
      version: update.version,
      changelog: update.changelog
    });
    
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
      .select('username discordUsername discordId avatar discordAvatar platform activisionId createdAt irisSecurityStatus irisHardwareId irisLastSeen irisScanMode irisScanChannelId')
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

    // Toggle scan mode
    const newScanMode = !player.irisScanMode;
    
    // Check if user is currently connected (for immediate screenshot request)
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    const isCurrentlyConnected = player.irisLastSeen && new Date(player.irisLastSeen) > threeMinutesAgo;
    
    // If enabling scan mode and no channel exists, create one
    if (newScanMode && !player.irisScanChannelId) {
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

      // Save the scan channel ID and enable scan mode
      await User.findByIdAndUpdate(userId, {
        irisScanChannelId: result.channelId,
        irisScanMode: true,
        irisScanImmediateRequest: isCurrentlyConnected // Request immediate screenshots if already connected
      });

      console.log(`[Iris Scan] Mode enabled for ${player.username || player.discordUsername} by ${admin.username}${isCurrentlyConnected ? ' (immediate screenshot requested)' : ''}`);

      return res.json({
        success: true,
        message: 'Mode surveillance activé',
        scanModeEnabled: true,
        channelId: result.channelId
      });
    }

    // If disabling scan mode and channel exists, delete it
    if (!newScanMode && player.irisScanChannelId) {
      // Delete the Discord channel
      await deleteIrisScanModeChannel(player.irisScanChannelId, player.username || player.discordUsername)
        .catch(err => console.error('[Iris Scan] Error deleting channel:', err.message));

      // Disable scan mode and remove channel ID
      await User.findByIdAndUpdate(userId, {
        irisScanMode: false,
        irisScanChannelId: null
      });

      console.log(`[Iris Scan] Mode disabled and channel deleted for ${player.username || player.discordUsername} by ${admin.username}`);

      return res.json({
        success: true,
        message: 'Mode surveillance désactivé et salon supprimé',
        scanModeEnabled: false,
        channelId: null
      });
    }

    // Just toggle the scan mode (channel already exists or disabling)
    const updateData = { irisScanMode: newScanMode };
    
    // If enabling scan mode and user is connected, request immediate screenshots
    if (newScanMode && isCurrentlyConnected) {
      updateData.irisScanImmediateRequest = true;
    }
    
    await User.findByIdAndUpdate(userId, updateData);

    console.log(`[Iris Scan] Mode ${newScanMode ? 'enabled' : 'disabled'} for ${player.username || player.discordUsername} by ${admin.username}${newScanMode && isCurrentlyConnected ? ' (immediate screenshot requested)' : ''}`);

    res.json({
      success: true,
      message: newScanMode ? 'Mode surveillance activé' : 'Mode surveillance désactivé',
      scanModeEnabled: newScanMode,
      channelId: player.irisScanChannelId
    });
  } catch (error) {
    console.error('[Iris Scan] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// ====== MANUAL DS4 SHADOW BAN (Admin Only) ======

import { sendManualDS4ShadowBan } from '../services/discordBot.service.js';

/**
 * Search for a user by username (for DS4 ban dialog)
 * GET /api/iris/admin/search-user?q=username
 */
router.get('/admin/search-user', verifyToken, async (req, res) => {
  try {
    const admin = await User.findById(req.user._id);
    if (!admin || !admin.roles.includes('admin')) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ success: true, users: [] });
    }

    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { discordUsername: { $regex: q, $options: 'i' } },
        { activisionId: { $regex: q, $options: 'i' } }
      ],
      isProfileComplete: true
    })
    .select('_id username discordUsername discordId avatarUrl avatar activisionId')
    .limit(10);

    res.json({ success: true, users });
  } catch (error) {
    console.error('[Iris DS4 Ban] Search error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * Issue a manual DS4 shadow ban
 * POST /api/iris/admin/ds4-shadowban
 * Body: { userId, durationHours }
 */
router.post('/admin/ds4-shadowban', verifyToken, async (req, res) => {
  try {
    const admin = await User.findById(req.user._id);
    if (!admin || !admin.roles.includes('admin')) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { userId, durationHours } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'ID utilisateur requis' });
    }

    if (!durationHours || durationHours < 1) {
      return res.status(400).json({ success: false, message: 'Durée invalide (min 1 heure)' });
    }

    // Find the user to ban
    const player = await User.findById(userId);
    if (!player) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    // Can't ban other admins
    if (player.roles.includes('admin')) {
      return res.status(403).json({ success: false, message: 'Impossible de bannir un administrateur' });
    }

    // Calculate ban expiration
    const now = new Date();
    const banExpiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    // Apply the shadow ban
    player.isBanned = true;
    player.banReason = 'Utilisation de DS4Windows (programme interdit) en match';
    player.bannedAt = now;
    player.banExpiresAt = banExpiresAt;
    player.bannedBy = admin._id;

    // Add to ban history
    if (!player.banHistory) player.banHistory = [];
    player.banHistory.push({
      type: 'global',
      reason: 'Utilisation de DS4Windows (programme interdit) en match',
      bannedAt: now,
      expiresAt: banExpiresAt,
      bannedBy: admin._id,
      source: 'iris_ds4_manual'
    });

    await player.save();

    // Send Discord notification
    await sendManualDS4ShadowBan(player, durationHours, admin);

    console.log(`[Iris DS4 Ban] ${player.username} shadow banned for ${durationHours}h by ${admin.username}`);

    res.json({
      success: true,
      message: `${player.username} a été shadow ban pour ${durationHours}h`,
      player: {
        username: player.username,
        banExpiresAt: banExpiresAt
      }
    });
  } catch (error) {
    console.error('[Iris DS4 Ban] Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ====== TAURI UPDATER ENDPOINT ======

/**
 * Tauri Updater endpoint
 * GET /api/iris/tauri-update
 * Returns update info in Tauri's expected format
 * Called directly by Tauri updater - no auth required
 * 
 * Tauri expects this format:
 * {
 *   "version": "1.0.0",
 *   "notes": "Changelog here",
 *   "pub_date": "2024-01-01T00:00:00Z",
 *   "platforms": {
 *     "windows-x86_64": {
 *       "signature": "base64-signature",
 *       "url": "https://..."
 *     }
 *   }
 * }
 */
router.get('/tauri-update', async (req, res) => {
  try {
    // Get current version query param (sent by Tauri)
    const { current_version, target } = req.query;
    const platform = target || 'windows-x86_64';
    
    console.log(`[Iris Tauri Update] Check request - current: ${current_version}, platform: ${platform}`);
    
    // Find the current (latest) active update
    const currentUpdate = await IrisUpdate.findOne({ 
      isCurrent: true, 
      isActive: true 
    });
    
    if (!currentUpdate) {
      console.log('[Iris Tauri Update] No current update found');
      // Return 204 No Content when no update available
      return res.status(204).send();
    }
    
    // Compare versions - only send update if newer
    if (current_version) {
      const currentParts = current_version.split('.').map(Number);
      const latestParts = currentUpdate.version.split('.').map(Number);
      
      const isNewer = latestParts[0] > currentParts[0] ||
        (latestParts[0] === currentParts[0] && latestParts[1] > currentParts[1]) ||
        (latestParts[0] === currentParts[0] && latestParts[1] === currentParts[1] && latestParts[2] > currentParts[2]);
      
      if (!isNewer) {
        console.log(`[Iris Tauri Update] Already on latest version (${current_version} >= ${currentUpdate.version})`);
        return res.status(204).send();
      }
    }
    
    console.log(`[Iris Tauri Update] Update available: ${currentUpdate.version}`);
    
    // Build Tauri-compatible response
    const response = {
      version: currentUpdate.version,
      notes: currentUpdate.changelog || `Iris v${currentUpdate.version}`,
      pub_date: currentUpdate.releasedAt?.toISOString() || new Date().toISOString(),
      platforms: {
        'windows-x86_64': {
          signature: currentUpdate.signature || '', // Signature from admin panel
          url: currentUpdate.downloadUrl
        }
      }
    };
    
    // Increment download count
    currentUpdate.downloadCount = (currentUpdate.downloadCount || 0) + 1;
    await currentUpdate.save();
    
    res.json(response);
  } catch (error) {
    console.error('[Iris Tauri Update] Error:', error);
    res.status(500).json({
      error: 'Server error'
    });
  }
});

// ====== BEHAVIORAL ANALYSIS ENDPOINTS ======

import BehavioralProfile from '../models/BehavioralProfile.js';

/**
 * Submit behavioral data from Iris client
 * POST /api/iris/behavioral
 * Protected by: HMAC signature verification
 */
router.post('/behavioral', verifyIrisSignature, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, IRIS_JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    if (decoded.type !== 'iris') {
      return res.status(401).json({ success: false, message: 'Invalid token type' });
    }

    const { metrics, matchId } = req.body;

    if (!metrics || typeof metrics !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid metrics data' });
    }

    // Find or create behavioral profile
    let profile = await BehavioralProfile.findOne({ user: decoded.userId });
    
    if (!profile) {
      profile = new BehavioralProfile({ user: decoded.userId });
    }

    // Build session data from metrics
    const sessionData = {
      matchId: matchId ? mongoose.Types.ObjectId.createFromHexString(matchId) : null,
      matchType: null, // Could be determined from match if matchId provided
      sessionStart: new Date(metrics.collectedAt - metrics.sessionDurationMs),
      sessionEnd: new Date(metrics.collectedAt),
      sessionDurationMs: metrics.sessionDurationMs || 0,
      
      // Mouse metrics
      avgMouseVelocity: metrics.avgMouseVelocity || 0,
      maxMouseVelocity: metrics.maxMouseVelocity || 0,
      velocityStdDev: metrics.velocityStdDev || 0,
      avgAcceleration: metrics.avgAcceleration || 0,
      maxAcceleration: metrics.maxAcceleration || 0,
      directionChanges: metrics.directionChanges || 0,
      microCorrections: metrics.microCorrections || 0,
      straightLineRatio: metrics.straightLineRatio || 0,
      clickAccuracyZone: metrics.clickAccuracyZone || 0,
      
      // Reaction metrics
      avgReactionTime: metrics.avgReactionTime || 0,
      minReactionTime: metrics.minReactionTime || 0,
      reactionTimeStdDev: metrics.reactionTimeStdDev || 0,
      
      // Keyboard metrics
      avgKeyHoldDuration: metrics.avgKeyHoldDuration || 0,
      keysPerMinute: metrics.keysPerMinute || 0,
      keyPatternConsistency: metrics.keyPatternConsistency || 0,
      
      // Anomaly scores from client
      aimSnapScore: metrics.aimSnapScore || 0,
      consistencyScore: metrics.consistencyScore || 0,
      reactionScore: metrics.reactionScore || 0,
      overallAnomalyScore: metrics.overallAnomalyScore || 0,
      
      sampleCount: metrics.sampleCount || 0
    };

    // Add session and get analysis result
    const analysisResult = await profile.addSession(sessionData);
    await profile.save();

    console.log(`[Iris Behavioral] Session recorded for user ${decoded.userId}, anomaly: ${analysisResult.isAnomalous}, score: ${sessionData.overallAnomalyScore}`);

    // If anomalous, could trigger Discord alert here
    if (analysisResult.isAnomalous && analysisResult.riskLevel === 'critical') {
      const user = await User.findById(decoded.userId).select('username irisScanChannelId');
      if (user && user.irisScanChannelId) {
        // Send alert to scan channel
        sendIrisExtendedAlert(
          user.irisScanChannelId,
          user.username,
          'behavioral_anomaly',
          `Anomalie comportementale détectée (Score: ${sessionData.overallAnomalyScore})\n` +
          analysisResult.flags.map(f => `• ${f.description}`).join('\n')
        ).catch(err => console.error('[Iris Behavioral] Discord alert error:', err));
      }
    }

    res.json({
      success: true,
      isAnomalous: analysisResult.isAnomalous,
      anomalyScore: sessionData.overallAnomalyScore,
      riskLevel: analysisResult.riskLevel,
      baselineDeviation: analysisResult.baselineDeviation,
      flags: analysisResult.flags.map(f => ({
        flagType: f.flagType,
        description: f.description,
        severity: f.severity
      })),
      trustScore: profile.trustScore.score,
      baselineEstablished: profile.baseline.established
    });

  } catch (error) {
    console.error('[Iris Behavioral] Submit error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * Get player's behavioral baseline
 * GET /api/iris/behavioral/baseline
 */
router.get('/behavioral/baseline', verifyIrisSignature, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, IRIS_JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const profile = await BehavioralProfile.findOne({ user: decoded.userId });

    if (!profile) {
      return res.json({
        success: true,
        hasBaseline: false,
        sampleCount: 0
      });
    }

    res.json({
      success: true,
      hasBaseline: profile.baseline.established,
      sampleCount: profile.totalSessionsRecorded,
      avgMouseVelocity: profile.baseline.avgMouseVelocity,
      avgReactionTime: profile.baseline.avgReactionTime,
      consistencyProfile: profile.baseline.avgMouseVelocityStdDev,
      trustScore: profile.trustScore.score,
      confidence: profile.baseline.confidence
    });

  } catch (error) {
    console.error('[Iris Behavioral] Get baseline error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * Get behavioral analysis for a player (Admin only)
 * GET /api/iris/behavioral/player/:userId
 */
router.get('/behavioral/player/:userId', verifyToken, async (req, res) => {
  try {
    const admin = await User.findById(req.user._id);
    if (!admin || !admin.roles.includes('admin') && !admin.roles.includes('staff')) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const profile = await BehavioralProfile.findOne({ user: req.params.userId })
      .populate('user', 'username discordUsername avatarUrl');

    if (!profile) {
      return res.json({
        success: true,
        hasProfile: false
      });
    }

    res.json({
      success: true,
      hasProfile: true,
      profile: {
        user: profile.user,
        baseline: profile.baseline,
        trustScore: profile.trustScore,
        totalSessions: profile.totalSessionsRecorded,
        totalAnomalies: profile.totalAnomaliesDetected,
        lastSessionAt: profile.lastSessionAt,
        lastAnomalyAt: profile.lastAnomalyAt,
        recentSessions: profile.sessions.slice(-10).reverse(),
        recentAnomalies: profile.anomalyHistory.slice(-20).reverse()
      }
    });

  } catch (error) {
    console.error('[Iris Behavioral] Get player error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * Get all players with behavioral anomalies (Admin only)
 * GET /api/iris/behavioral/anomalies
 */
router.get('/behavioral/anomalies', verifyToken, async (req, res) => {
  try {
    const admin = await User.findById(req.user._id);
    if (!admin || !admin.roles.includes('admin') && !admin.roles.includes('staff')) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { limit = 50, minScore = 50 } = req.query;

    // Find profiles with recent anomalies
    const profiles = await BehavioralProfile.find({
      totalAnomaliesDetected: { $gt: 0 }
    })
      .populate('user', 'username discordUsername avatarUrl isBanned')
      .sort({ lastAnomalyAt: -1 })
      .limit(parseInt(limit));

    const results = profiles.map(p => ({
      userId: p.user._id,
      username: p.user.username,
      discordUsername: p.user.discordUsername,
      avatarUrl: p.user.avatarUrl,
      isBanned: p.user.isBanned,
      trustScore: p.trustScore.score,
      totalAnomalies: p.totalAnomaliesDetected,
      totalSessions: p.totalSessionsRecorded,
      anomalyRate: p.totalSessionsRecorded > 0 
        ? (p.totalAnomaliesDetected / p.totalSessionsRecorded * 100).toFixed(1) 
        : 0,
      lastAnomalyAt: p.lastAnomalyAt,
      recentFlags: p.anomalyHistory.slice(-3).flatMap(a => a.flags.map(f => f.flagType))
    }));

    res.json({
      success: true,
      players: results,
      total: results.length
    });

  } catch (error) {
    console.error('[Iris Behavioral] Get anomalies error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * Mark anomaly as reviewed (Admin only)
 * POST /api/iris/behavioral/review/:anomalyId
 */
router.post('/behavioral/review/:anomalyId', verifyToken, async (req, res) => {
  try {
    const admin = await User.findById(req.user._id);
    if (!admin || !admin.roles.includes('admin')) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { userId, falsePositive, notes } = req.body;

    const profile = await BehavioralProfile.findOne({ user: userId });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Find the anomaly in history
    const anomaly = profile.anomalyHistory.id(req.params.anomalyId);
    if (!anomaly) {
      return res.status(404).json({ success: false, message: 'Anomaly not found' });
    }

    anomaly.reviewed = true;
    anomaly.reviewedBy = admin._id;
    anomaly.reviewedAt = new Date();
    anomaly.reviewNotes = notes || '';
    anomaly.falsePositive = falsePositive || false;

    // Adjust trust score if false positive
    if (falsePositive) {
      profile.trustScore.score = Math.min(100, profile.trustScore.score + 10);
      profile.trustScore.flaggedSessions = Math.max(0, profile.trustScore.flaggedSessions - 1);
    }

    await profile.save();

    console.log(`[Iris Behavioral] Anomaly reviewed by ${admin.username}, falsePositive: ${falsePositive}`);

    res.json({
      success: true,
      message: 'Anomaly reviewed'
    });

  } catch (error) {
    console.error('[Iris Behavioral] Review error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ====== IRIS WHITELIST MANAGEMENT ======

/**
 * Get all whitelist entries (Admin only)
 * GET /api/iris/whitelist
 */
router.get('/whitelist', verifyToken, async (req, res) => {
  try {
    const admin = await User.findById(req.user._id);
    if (!admin || !admin.roles.includes('admin')) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { type, search, active } = req.query;

    // Build query
    const query = {};
    if (type) query.type = type;
    if (active !== undefined) query.isActive = active === 'true';
    if (search) {
      query.$or = [
        { identifier: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
        { reason: { $regex: search, $options: 'i' } }
      ];
    }

    const entries = await IrisWhitelist.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Get stats by type
    const statsByType = await IrisWhitelist.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      entries,
      total: entries.length,
      stats: statsByType.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {})
    });

  } catch (error) {
    console.error('[Iris Whitelist] Get entries error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * Add a whitelist entry manually (Admin only)
 * POST /api/iris/whitelist
 */
router.post('/whitelist', verifyToken, async (req, res) => {
  try {
    const admin = await User.findById(req.user._id);
    if (!admin || !admin.roles.includes('admin')) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { type, identifier, displayName, reason, secondaryIdentifier } = req.body;

    if (!type || !identifier) {
      return res.status(400).json({ success: false, message: 'Type and identifier required' });
    }

    // Check if already exists
    const existing = await IrisWhitelist.findOne({
      type,
      identifier: { $regex: new RegExp(`^${identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      isActive: true
    });

    if (existing) {
      return res.status(409).json({ 
        success: false, 
        message: 'This item is already whitelisted',
        existingEntry: existing
      });
    }

    const newEntry = new IrisWhitelist({
      type,
      identifier,
      secondaryIdentifier: secondaryIdentifier || undefined,
      displayName: displayName || identifier,
      reason: reason || `Ajouté manuellement par ${admin.username}`,
      addedBy: admin.username,
      addedByDiscordId: admin.discordId
    });

    await newEntry.save();

    console.log(`[Iris Whitelist] ${admin.username} added whitelist: ${type}/${identifier}`);

    res.json({
      success: true,
      message: 'Whitelist entry added',
      entry: newEntry
    });

  } catch (error) {
    console.error('[Iris Whitelist] Add entry error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This item is already whitelisted' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * Delete/deactivate a whitelist entry (Admin only)
 * DELETE /api/iris/whitelist/:id
 */
router.delete('/whitelist/:id', verifyToken, async (req, res) => {
  try {
    const admin = await User.findById(req.user._id);
    if (!admin || !admin.roles.includes('admin')) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { id } = req.params;
    const { permanent } = req.query;

    const entry = await IrisWhitelist.findById(id);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Whitelist entry not found' });
    }

    if (permanent === 'true') {
      // Permanently delete
      await IrisWhitelist.findByIdAndDelete(id);
      console.log(`[Iris Whitelist] ${admin.username} permanently deleted whitelist: ${entry.type}/${entry.identifier}`);
    } else {
      // Soft delete (deactivate)
      entry.isActive = false;
      await entry.save();
      console.log(`[Iris Whitelist] ${admin.username} deactivated whitelist: ${entry.type}/${entry.identifier}`);
    }

    res.json({
      success: true,
      message: permanent === 'true' ? 'Whitelist entry deleted' : 'Whitelist entry deactivated'
    });

  } catch (error) {
    console.error('[Iris Whitelist] Delete entry error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * Reactivate a whitelist entry (Admin only)
 * POST /api/iris/whitelist/:id/reactivate
 */
router.post('/whitelist/:id/reactivate', verifyToken, async (req, res) => {
  try {
    const admin = await User.findById(req.user._id);
    if (!admin || !admin.roles.includes('admin')) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { id } = req.params;

    const entry = await IrisWhitelist.findById(id);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Whitelist entry not found' });
    }

    entry.isActive = true;
    await entry.save();

    console.log(`[Iris Whitelist] ${admin.username} reactivated whitelist: ${entry.type}/${entry.identifier}`);

    res.json({
      success: true,
      message: 'Whitelist entry reactivated',
      entry
    });

  } catch (error) {
    console.error('[Iris Whitelist] Reactivate entry error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * Get whitelist types and their counts (Admin only)
 * GET /api/iris/whitelist/stats
 */
router.get('/whitelist/stats', verifyToken, async (req, res) => {
  try {
    const admin = await User.findById(req.user._id);
    if (!admin || !admin.roles.includes('admin')) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const stats = await IrisWhitelist.aggregate([
      {
        $group: {
          _id: { type: '$type', isActive: '$isActive' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.type',
          active: {
            $sum: { $cond: [{ $eq: ['$_id.isActive', true] }, '$count', 0] }
          },
          inactive: {
            $sum: { $cond: [{ $eq: ['$_id.isActive', false] }, '$count', 0] }
          },
          total: { $sum: '$count' }
        }
      }
    ]);

    const totalActive = await IrisWhitelist.countDocuments({ isActive: true });
    const totalInactive = await IrisWhitelist.countDocuments({ isActive: false });

    res.json({
      success: true,
      byType: stats.reduce((acc, s) => ({ ...acc, [s._id]: { active: s.active, inactive: s.inactive, total: s.total } }), {}),
      total: {
        active: totalActive,
        inactive: totalInactive,
        all: totalActive + totalInactive
      }
    });

  } catch (error) {
    console.error('[Iris Whitelist] Get stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
