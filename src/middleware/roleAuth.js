const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token and extract user info
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
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token - user not found' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

// Middleware to check if user has required role(s)
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    const userRole = req.user.role;
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: `Access denied. Required role(s): ${allowedRoles.join(', ')}` 
      });
    }

    next();
  };
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }

  next();
};

// Middleware to check if user is vendor or admin
const requireVendorOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  const userRole = req.user.role;
  if (userRole !== 'vendor' && userRole !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Vendor or admin access required' 
    });
  }

  next();
};

// Middleware to check if user owns the resource or is admin
const requireOwnershipOrAdmin = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    const isAdmin = req.user.role === 'admin';
    const isOwner = req.params.id === req.user._id.toString() || 
                   req.body[resourceUserIdField] === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. You can only access your own resources' 
      });
    }

    next();
  };
};

// Middleware to validate item ownership for vendors (admins can access all items)
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

  // Vendors can only access their own items
  if (req.user.role === 'vendor') {
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

      if (item.vendorId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only manage your own items'
        });
      }

      // Store item in request for potential use in route handlers
      req.item = item;
      return next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error validating item ownership'
      });
    }
  }

  return res.status(403).json({
    success: false,
    message: 'Insufficient permissions'
  });
};

// Middleware to validate bulk operations on items
const requireBulkItemPermissions = async (req, res, next) => {
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

  // Vendors can only perform bulk operations on their own items
  if (req.user.role === 'vendor') {
    try {
      const Item = require('../models/Item');
      const { itemIds } = req.body;
      
      if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Item IDs array required'
        });
      }

      const items = await Item.find({ _id: { $in: itemIds } });
      
      // Check if all items belong to the vendor
      const unauthorizedItems = items.filter(
        item => item.vendorId.toString() !== req.user._id.toString()
      );

      if (unauthorizedItems.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only perform bulk operations on your own items'
        });
      }

      // Store items in request for potential use in route handlers
      req.items = items;
      return next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error validating bulk item permissions'
      });
    }
  }

  return res.status(403).json({
    success: false,
    message: 'Insufficient permissions'
  });
};

// Optional middleware to get user info if token is provided
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (user) {
      req.user = user;
    }
  } catch (error) {
    // Silently fail for optional auth
    console.log('Optional auth failed:', error.message);
  }

  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireVendorOrAdmin,
  requireOwnershipOrAdmin,
  requireItemOwnershipOrAdmin,
  requireBulkItemPermissions,
  optionalAuth
};