const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Admin authentication middleware
 * Verifies JWT token and ensures user has admin role
 */
const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid token. User not found.',
        code: 'INVALID_TOKEN'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ 
        error: 'Account is deactivated.',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    // Check if user has admin role
    if (user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied. Administrator privileges required.',
        code: 'INSUFFICIENT_PRIVILEGES'
      });
    }

    // Add user to request object
    req.user = user;
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token.',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    console.error('Admin auth middleware error:', error);
    res.status(500).json({ 
      error: 'Server error during authentication.',
      code: 'SERVER_ERROR'
    });
  }
};

/**
 * Admin or Super Admin authentication middleware
 * Allows both admin and superAdmin roles
 */
const adminOrSuperAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid token. User not found.',
        code: 'INVALID_TOKEN'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        error: 'Account is deactivated.',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    if (!['admin', 'superAdmin'].includes(user.role)) {
      return res.status(403).json({ 
        error: 'Access denied. Administrator privileges required.',
        code: 'INSUFFICIENT_PRIVILEGES'
      });
    }

    req.user = user;
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token.',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    console.error('Admin auth middleware error:', error);
    res.status(500).json({ 
      error: 'Server error during authentication.',
      code: 'SERVER_ERROR'
    });
  }
};

/**
 * Log admin actions for audit trail
 */
const logAdminAction = (action) => {
  return (req, res, next) => {
    // Store action info for audit logging
    req.adminAction = {
      action,
      userId: req.user?.id,
      username: req.user?.username,
      timestamp: new Date(),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };
    next();
  };
};

module.exports = {
  adminAuth,
  adminOrSuperAuth,
  logAdminAction
};