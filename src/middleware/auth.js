const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

    // Check if account is locked due to failed 2FA attempts
    if (user.twoFactorAuth?.isLocked && user.twoFactorAuth?.lockUntil > new Date()) {
      const remainingTime = Math.ceil((user.twoFactorAuth.lockUntil - new Date()) / (1000 * 60));
      return res.status(423).json({
        success: false,
        message: `Account temporarily locked due to multiple failed 2FA attempts. Try again in ${remainingTime} minutes.`
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

// Middleware to check 2FA verification status
const require2FA = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  // Skip 2FA check if user doesn't have it enabled
  if (!req.user.twoFactorAuth?.isEnabled) {
    return next();
  }

  // Check if account is locked due to failed 2FA attempts
  if (req.user.twoFactorAuth?.isLocked && req.user.twoFactorAuth?.lockUntil > new Date()) {
    const remainingTime = Math.ceil((req.user.twoFactorAuth.lockUntil - new Date()) / (1000 * 60));
    return res.status(423).json({
      success: false,
      message: `Account temporarily locked due to multiple failed 2FA attempts. Try again in ${remainingTime} minutes.`
    });
  }

  // Check if user has completed 2FA verification in this session
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // If token doesn't have 2FA verification flag, user needs to complete 2FA
    if (!decoded.twoFactorVerified) {
      return res.status(202).json({
        success: false,
        message: 'Two-factor authentication required',
        requiresTwoFactor: true,
        methods: {
          totp: req.user.twoFactorAuth.totp?.isEnabled || false,
          sms: req.user.twoFactorAuth.sms?.isEnabled || false
        }
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

// Middleware to handle 2FA attempt tracking
const track2FAAttempts = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Check if this was a failed 2FA verification
    if (res.statusCode === 400 || res.statusCode === 401) {
      const responseData = typeof data === 'string' ? JSON.parse(data) : data;
      
      if (responseData && responseData.message && responseData.message.includes('2FA') && req.user) {
        // Track failed attempt asynchronously
        process.nextTick(async () => {
          try {
            const user = await User.findById(req.user._id);
            if (user && user.twoFactorAuth?.isEnabled) {
              const maxAttempts = 5;
              const lockDuration = 30; // minutes
              
              if (!user.twoFactorAuth.failedAttempts) {
                user.twoFactorAuth.failedAttempts = 0;
              }
              
              user.twoFactorAuth.failedAttempts += 1;
              user.twoFactorAuth.lastFailedAttempt = new Date();
              
              // Lock account if max attempts reached
              if (user.twoFactorAuth.failedAttempts >= maxAttempts) {
                user.twoFactorAuth.isLocked = true;
                user.twoFactorAuth.lockUntil = new Date(Date.now() + (lockDuration * 60 * 1000));
              }
              
              await user.save();
            }
          } catch (error) {
            console.error('Error tracking 2FA attempts:', error);
          }
        });
      }
    } else if (res.statusCode === 200 && req.user) {
      // Reset failed attempts on successful verification
      process.nextTick(async () => {
        try {
          const user = await User.findById(req.user._id);
          if (user && user.twoFactorAuth?.isEnabled && user.twoFactorAuth.failedAttempts > 0) {
            user.twoFactorAuth.failedAttempts = 0;
            user.twoFactorAuth.isLocked = false;
            user.twoFactorAuth.lockUntil = null;
            user.twoFactorAuth.lastFailedAttempt = null;
            await user.save();
          }
        } catch (error) {
          console.error('Error resetting 2FA attempts:', error);
        }
      });
    }
    
    originalSend.call(this, data);
  };
  
  next();
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

module.exports = {
  authenticateToken,
  require2FA,
  track2FAAttempts,
  authorizeRoles,
  requireAdmin,
  requireVendorOrAdmin,
  requireOwnershipOrAdmin,
  optionalAuth,
  authRateLimit
};