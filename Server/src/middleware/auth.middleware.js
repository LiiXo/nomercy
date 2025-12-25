import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Verify JWT token
export const verifyToken = async (req, res, next) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found.' 
      });
    }

    // Check if user is deleted
    if (user.isDeleted) {
      return res.status(403).json({ 
        success: false, 
        message: 'Your account has been deleted.',
        isDeleted: true
      });
    }

    // Check if user is banned
    if (user.isBanned) {
      // Check if ban has expired
      if (user.banExpiresAt && new Date() > user.banExpiresAt) {
        // Unban user automatically
        user.isBanned = false;
        user.banReason = null;
        user.banExpiresAt = null;
        await user.save();
      } else {
        // Ban is still active
        return res.status(403).json({ 
          success: false, 
          message: 'Your account has been banned.',
          reason: user.banReason,
          expiresAt: user.banExpiresAt,
          isBanned: true
        });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token.' 
    });
  }
};

// Check if profile is complete
export const requireCompleteProfile = (req, res, next) => {
  if (!req.user.isProfileComplete) {
    return res.status(403).json({ 
      success: false, 
      message: 'Please complete your profile first.',
      requiresProfileSetup: true
    });
  }
  next();
};

// Check for specific roles
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required.' 
      });
    }

    const hasRole = roles.some(role => req.user.roles.includes(role));
    
    if (!hasRole) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Insufficient permissions.' 
      });
    }

    next();
  };
};

// Admin only
export const requireAdmin = requireRole('admin');

// Staff (admin or staff)
export const requireStaff = requireRole('admin', 'staff');

// CDL Manager
export const requireCDLManager = requireRole('admin', 'gerant_cdl');

// Hardcore Manager  
export const requireHardcoreManager = requireRole('admin', 'gerant_hardcore');

