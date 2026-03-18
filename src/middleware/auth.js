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

// Middleware to check if user owns the item or is admin (for item management)
const requireItemOwnershipOrAdmin = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  // Admin can access all items
  if (req.user.role === 'admin') {
    return next();
  }

  try {
    const Item = require('../models/Item');
    const itemId = req.params.id || req.params.itemId;
    
    if (!itemId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Item ID required' 
      });
    }

    const item = await Item.findById(itemId);
    
    if (!item) {
      return res.status(404).json({ 
        success: false, 
        message: 'Item not found' 
      });
    }

    // Check if user owns the item (vendor check)
    if (item.vendorId && item.vendorId.toString() === req.user._id.toString()) {
      return next();
    }

    // Check if user created the item
    if (item.createdBy && item.createdBy.toString() === req.user._id.toString()) {
      return next();
    }

    return res.status(403).json({ 
      success: false, 
      message: 'Access denied: you can only manage your own items' 
    });

  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Error validating item ownership' 
    });
  }
};

// Middleware for bulk operations - ensures user can only perform bulk actions on their own items
const requireBulkItemAccess = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  // Admin can perform bulk operations on all items
  if (req.user.role === 'admin') {
    return next();
  }

  try {
    const Item = require('../models/Item');
    const itemIds = req.body.itemIds || [];
    
    if (!itemIds.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'Item IDs required for bulk operation' 
      });
    }

    // Check if user owns all the items they're trying to modify
    const items = await Item.find({ _id: { $in: itemIds } });
    
    if (items.length !== itemIds.length) {
      return res.status(404).json({ 
        success: false, 
        message: 'Some items not found' 
      });
    }

    const unauthorizedItems = items.filter(item => {
      const isVendorOwned = item.vendorId && item.vendorId.toString() === req.user._id.toString();
      const isCreatedByUser = item.createdBy && item.createdBy.toString() === req.user._id.toString();
      return !isVendorOwned && !isCreatedByUser;
    });

    if (unauthorizedItems.length > 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied: you can only perform bulk operations on your own items' 
      });
    }

    next();

  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Error validating bulk item access' 
    });
  }
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
  authorizeRoles,
  requireAdmin,
  requireVendorOrAdmin,
  requireOwnershipOrAdmin,
  requireItemOwnershipOrAdmin,
  requireBulkItemAccess,
  optionalAuth,
  authRateLimit
};