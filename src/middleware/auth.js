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

// Middleware to verify 2FA is completed for authenticated users
const require2FA = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  // Skip 2FA check if user hasn't enabled it
  if (!req.user.twoFactorEnabled) {
    return next();
  }

  // Check if token includes 2FA verification flag
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if this token was issued after successful 2FA verification
    if (!decoded.twoFactorVerified) {
      return res.status(403).json({ 
        success: false, 
        message: '2FA verification required',
        code: 'REQUIRE_2FA'
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

// Combined middleware that checks auth and 2FA in one step
const authenticateWithTwoFactor = async (req, res, next) => {
  await authenticateToken(req, res, async (error) => {
    if (error) return;
    
    await require2FA(req, res, next);
  });
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

// Enhanced rate limiting for 2FA attempts (stricter limits)
const twoFactorRateLimit = (maxAttempts = 3, windowMs = 5 * 60 * 1000) => {
  const attempts = new Map();

  return (req, res, next) => {
    const identifier = req.body.email || req.user?.email || req.ip;
    const now = Date.now();
    
    if (!attempts.has(identifier)) {
      attempts.set(identifier, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const userAttempts = attempts.get(identifier);
    
    if (now > userAttempts.resetTime) {
      attempts.set(identifier, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (userAttempts.count >= maxAttempts) {
      return res.status(429).json({
        success: false,
        message: 'Too many 2FA attempts. Please try again later.',
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
  authenticateWithTwoFactor,
  authorizeRoles,
  requireAdmin,
  requireVendorOrAdmin,
  requireOwnershipOrAdmin,
  optionalAuth,
  authRateLimit,
  twoFactorRateLimit
};