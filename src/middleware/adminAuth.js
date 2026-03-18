const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to verify JWT token and ensure user is authenticated
 */
const verifyToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies.token;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error during authentication.'
    });
  }
};

/**
 * Middleware to verify user has admin privileges
 */
const verifyAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('role isActive');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated.'
      });
    }

    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error during authorization check.'
    });
  }
};

/**
 * Middleware to verify user has super admin privileges
 */
const verifySuperAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('role isActive');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated.'
      });
    }

    if (user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Super admin privileges required.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error during super admin authorization check.'
    });
  }
};

/**
 * Combined middleware for admin authentication and authorization
 * Use this for admin dashboard routes
 */
const requireAdmin = [verifyToken, verifyAdmin];

/**
 * Combined middleware for super admin authentication and authorization
 */
const requireSuperAdmin = [verifyToken, verifySuperAdmin];

/**
 * Middleware to log admin actions for audit purposes
 */
const logAdminAction = (action) => {
  return (req, res, next) => {
    // Store action info in request for later logging
    req.adminAction = {
      action,
      userId: req.userId,
      timestamp: new Date(),
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };
    
    // Continue to next middleware
    next();
  };
};

/**
 * Middleware to check rate limiting for admin actions
 */
const adminRateLimit = (req, res, next) => {
  // Basic rate limiting could be implemented here
  // For now, just pass through
  // In production, consider using express-rate-limit
  next();
};

module.exports = {
  verifyToken,
  verifyAdmin,
  verifySuperAdmin,
  requireAdmin,
  requireSuperAdmin,
  logAdminAction,
  adminRateLimit
};