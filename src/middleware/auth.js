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

// Audit logging middleware for item management actions
const auditItemManagement = (action) => {
  return async (req, res, next) => {
    // Store original res.json to capture response data
    const originalJson = res.json.bind(res);
    
    res.json = function(body) {
      // Only log successful operations (status 2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setImmediate(async () => {
          try {
            const AuditLog = require('../models/AuditLog');
            
            // Prepare audit data
            const auditData = {
              userId: req.user?._id,
              userName: req.user?.name || req.user?.email,
              action: action,
              resource: 'item',
              resourceId: req.params.id || body.data?.id || body.data?._id,
              details: {
                method: req.method,
                url: req.originalUrl,
                userAgent: req.get('User-Agent'),
                ip: req.ip || req.connection.remoteAddress,
                timestamp: new Date()
              },
              metadata: {}
            };

            // Add specific details based on action
            switch (action) {
              case 'item_create':
                auditData.details.itemData = {
                  name: req.body.name,
                  category: req.body.category,
                  price: req.body.price
                };
                break;
              case 'item_update':
                auditData.details.itemId = req.params.id;
                auditData.details.updatedFields = Object.keys(req.body);
                break;
              case 'item_delete':
                auditData.details.itemId = req.params.id;
                break;
              case 'item_bulk_update':
                auditData.details.itemIds = req.body.itemIds;
                auditData.details.updatedFields = Object.keys(req.body.updateData || {});
                break;
              case 'item_bulk_delete':
                auditData.details.itemIds = req.body.itemIds;
                break;
            }

            // Save audit log
            await AuditLog.create(auditData);
          } catch (error) {
            console.error('Audit logging failed:', error);
            // Don't fail the request if audit logging fails
          }
        });
      }
      
      return originalJson(body);
    };

    next();
  };
};

// Middleware for admin item management permissions with enhanced validation
const requireAdminItemAccess = async (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required for item management' 
    });
  }

  // Additional validation for bulk operations
  if (req.body.itemIds && Array.isArray(req.body.itemIds)) {
    if (req.body.itemIds.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Bulk operations limited to 100 items at once'
      });
    }
  }

  next();
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  requireAdmin,
  requireVendorOrAdmin,
  requireOwnershipOrAdmin,
  optionalAuth,
  authRateLimit,
  auditItemManagement,
  requireAdminItemAccess
};