import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Discord OAuth login
router.get('/discord', passport.authenticate('discord'));

// Cookie options helper (shared between login and logout)
const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const options = {
    httpOnly: true,
    secure: isProduction, // Required for sameSite: 'none'
    sameSite: isProduction ? 'none' : 'lax', // 'none' allows cross-origin requests in production
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };
  
  // Set domain for cross-subdomain cookie sharing in production
  if (isProduction && process.env.COOKIE_DOMAIN) {
    options.domain = process.env.COOKIE_DOMAIN; // e.g., '.ggsecure.io'
  }
  
  return options;
};

// Discord OAuth callback
router.get('/discord/callback', 
  passport.authenticate('discord', { session: false, failureRedirect: `${process.env.CLIENT_URL}/login?error=auth_failed` }),
  async (req, res) => {
    const token = generateToken(req.user);
    
    // Capture IP address (handle proxies)
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     req.headers['x-real-ip'] || 
                     req.connection?.remoteAddress || 
                     req.socket?.remoteAddress ||
                     req.ip;
    
    // Update user's last IP and login time
    try {
      const User = (await import('../models/User.js')).default;
      await User.findByIdAndUpdate(req.user._id, {
        lastIp: clientIp,
        lastLoginAt: new Date()
      });
    } catch (err) {
      console.error('Error updating user IP:', err);
    }
    
    // Set HTTP-only cookie with proper cross-origin settings
    res.cookie('token', token, getCookieOptions());

    // Redirect based on profile completion
    if (!req.user.isProfileComplete) {
      res.redirect(`${process.env.CLIENT_URL}/setup-profile`);
    } else {
      res.redirect(`${process.env.CLIENT_URL}/`);
    }
  }
);

// Get current user
router.get('/me', verifyToken, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      discordId: req.user.discordId,
      discordUsername: req.user.discordUsername,
      username: req.user.username,
      bio: req.user.bio,
      avatar: req.user.avatarUrl,
      banner: req.user.banner,
      platform: req.user.platform,
      activisionId: req.user.activisionId,
      roles: req.user.roles,
      isProfileComplete: req.user.isProfileComplete,
      goldCoins: req.user.goldCoins,
      stats: req.user.stats,
      statsResetCount: req.user.statsResetCount || 0,
      createdAt: req.user.createdAt
    }
  });
});

// Logout
router.post('/logout', (req, res) => {
  // Clear cookie with same options (domain must match for cookie to be deleted)
  const cookieOptions = getCookieOptions();
  delete cookieOptions.maxAge; // Remove maxAge for clearing
  res.clearCookie('token', cookieOptions);
  res.json({ success: true, message: 'Logged out successfully' });
});

// Check auth status (no error if not logged in)
router.get('/status', async (req, res) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.json({ success: true, isAuthenticated: false });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const User = (await import('../models/User.js')).default;
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.json({ success: true, isAuthenticated: false });
    }

    res.json({
      success: true,
      isAuthenticated: true,
      user: {
        id: user._id,
        discordId: user.discordId,
        discordUsername: user.discordUsername,
        username: user.username,
        bio: user.bio,
        avatar: user.avatarUrl,
        banner: user.banner,
        platform: user.platform,
        activisionId: user.activisionId,
        roles: user.roles,
        isProfileComplete: user.isProfileComplete,
        goldCoins: user.goldCoins,
        stats: user.stats,
        statsResetCount: user.statsResetCount || 0,
        isBanned: user.isBanned,
        banReason: user.banReason,
        banExpiresAt: user.banExpiresAt,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.json({ success: true, isAuthenticated: false });
  }
});

export default router;

