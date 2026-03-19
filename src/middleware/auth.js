const jwt = require('jsonwebtoken');
const User = require('../models/User');
const speakeasy = require('speakeasy');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fetch user from database to ensure user still exists and get latest role
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Account is deactivated' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }
    
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid token' 
    });
  }
};

// Middleware to require 2FA verification for protected routes
const require2FA = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Skip 2FA check if user hasn't enabled it - explicit null/undefined check
  if (req.user.twoFactorEnabled !== true) {
    return next();
  }

  // Check if user has completed 2FA in this session
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token includes 2FA verification flag
    if (!decoded.twoFactorVerified) {
      return res.status(401).json({
        success: false,
        message: '2FA verification required',
        requiresTwoFactor: true
      });
    }
    
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// Middleware to verify TOTP code
const verify2FACode = async (req, res, next) => {
  const { twoFactorCode } = req.body;
  
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.twoFactorEnabled !== true || !req.user.twoFactorSecret) {
    return res.status(400).json({
      success: false,
      message: '2FA not enabled for this account'
    });
  }

  if (!twoFactorCode) {
    return res.status(400).json({
      success: false,
      message: '2FA code required'
    });
  }

  try {
    // Check if it's a backup code
    if (req.user.backupCodes && req.user.backupCodes.includes(twoFactorCode)) {
      // Remove used backup code
      req.user.backupCodes = req.user.backupCodes.filter(code => code !== twoFactorCode);
      await req.user.save();
      req.twoFactorVerified = true;
      return next();
    }

    // Verify TOTP code
    const verified = speakeasy.totp.verify({
      secret: req.user.twoFactorSecret,
      encoding: 'base32',
      token: twoFactorCode,
      window: 2 // Allow some time drift
    });

    if (!verified) {
      // Track failed attempt
      const ip = req.ip || req.connection.remoteAddress;
      await trackFailedAttempt(req.user._id, ip, 'invalid_2fa_code');
      
      return res.status(401).json({
        success: false,
        message: 'Invalid 2FA code'
      });
    }

    req.twoFactorVerified = true;
    next();
  } catch (error) {
    console.error('2FA verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying 2FA code'
    });
  }
};

// Helper function to track failed attempts
const trackFailedAttempt = async (userId, ip, attemptType) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    // Initialize failed attempts array if not exists
    if (!user.failedLoginAttempts) {
      user.failedLoginAttempts = [];
    }

    // Remove attempts older than 15 minutes
    user.failedLoginAttempts = user.failedLoginAttempts.filter(
      attempt => attempt.timestamp > fifteenMinutesAgo
    );

    // Add new failed attempt
    user.failedLoginAttempts.push({
      timestamp: now,
      ip: ip,
      type: attemptType
    });

    // Check if account should be locked
    const recentAttempts = user.failedLoginAttempts.length;
    if (recentAttempts >= 5) {
      user.accountLocked = true;
      user.lockoutExpires = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes lockout
      
      // TODO: Send email notification about account lockout
      console.log(`Account locked for user ${userId} due to excessive failed attempts`);
    }

    await user.save();
  } catch (error) {
    console.error('Error tracking failed attempt:', error);
  }
};

// Middleware to check if user has required role(s)
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Insufficient permissions' 
      });
    }

    next();
  };
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }
  next();
};

// Middleware to check if user is vendor or admin
const requireVendorOrAdmin = (req, res, next) => {
  if (!req.user || !['vendor', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ 
      success: false, 
      message: 'Vendor or admin access required' 
    });
  }
  next();
};

// Middleware to check if user owns the resource or is admin
const requireOwnershipOrAdmin = (userIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    const resourceUserId = req.params[userIdField] || req.body[userIdField];
    
    if (req.user.role === 'admin' || req.user._id.toString() === resourceUserId) {
      next();
    } else {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied: insufficient permissions' 
      });
    }
  };
};

// Optional authentication - doesn't fail if no token provided
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (user && user.isActive) {
      req.user = user;
    } else {
      req.user = null;
    }
  } catch (error) {
    req.user = null;
  }

  next();
};

// Rate limiting middleware for auth routes
const authRateLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!attempts.has(ip)) {
      attempts.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const userAttempts = attempts.get(ip);
    
    if (now > userAttempts.resetTime) {
      attempts.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (userAttempts.count >= maxAttempts) {
      return res.status(429).json({
        success: false,
        message: 'Too many authentication attempts. Please try again later.',
        retryAfter: Math.ceil((userAttempts.resetTime - now) / 1000)
      });
    }

    userAttempts.count++;
    next();
  };
};

// Specific rate limiting for 2FA attempts
const twoFAReateLimit = authRateLimit(5, 15 * 60 * 1000);

// Middleware to check account lockout status
const checkAccountLockout = async (req, res, next) => {
  if (!req.user) {
    return next();
  }

  if (req.user.accountLocked) {
    const now = new Date();
    
    // Check if lockout has expired
    if (req.user.lockoutExpires && now > req.user.lockoutExpires) {
      req.user.accountLocked = false;
      req.user.lockoutExpires = null;
      req.user.failedLoginAttempts = [];
      await req.user.save();
      return next();
    }

    const timeRemaining = req.user.lockoutExpires ? 
      Math.ceil((req.user.lockoutExpires - now) / 1000 / 60) : 30;

    return res.status(423).json({
      success: false,
      message: 'Account temporarily locked due to excessive failed attempts',
      lockedUntil: req.user.lockoutExpires,
      minutesRemaining: timeRemaining
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  require2FA,
  verify2FACode,
  authorizeRoles,
  requireAdmin,
  requireVendorOrAdmin,
  requireOwnershipOrAdmin,
  optionalAuth,
  authRateLimit,
  twoFAReateLimit,
  checkAccountLockout
};