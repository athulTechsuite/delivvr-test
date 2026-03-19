const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

// Validate JWT secret is properly configured
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required and must be set');
}

// JWT Configuration
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
};

// Two-Factor Authentication Configuration
const TOTP_CONFIG = {
  name: process.env.APP_NAME || 'Delivvr',
  issuer: process.env.APP_NAME || 'Delivvr',
  window: 2, // Allow 2 time steps before/after current time
  length: 6, // 6-digit codes
  step: 30, // 30-second time step
  encoding: 'base32'
};

// 2FA Method Types
const TWO_FA_METHODS = {
  TOTP: 'totp',
  SMS: 'sms'
};

// User Roles
const USER_ROLES = {
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  VENDOR: 'vendor',
  SUPER_ADMIN: 'super_admin'
};

// Role Permissions
const ROLE_PERMISSIONS = {
  [USER_ROLES.CUSTOMER]: [
    'view_products',
    'manage_cart',
    'place_order',
    'view_own_orders',
    'manage_wishlist',
    'update_profile'
  ],
  [USER_ROLES.VENDOR]: [
    'view_products',
    'manage_own_products',
    'view_own_orders',
    'manage_inventory',
    'view_sales_analytics',
    'update_profile'
  ],
  [USER_ROLES.ADMIN]: [
    'view_products',
    'manage_all_products',
    'manage_users',
    'view_all_orders',
    'manage_categories',
    'view_analytics',
    'manage_vendors',
    'update_profile'
  ],
  [USER_ROLES.SUPER_ADMIN]: [
    'manage_everything',
    'manage_admins',
    'system_settings',
    'view_system_logs'
  ]
};

// Generate JWT Token
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_CONFIG.secret, {
    expiresIn: JWT_CONFIG.expiresIn
  });
};

// Generate Refresh Token
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_CONFIG.secret, {
    expiresIn: JWT_CONFIG.refreshExpiresIn
  });
};

// Verify JWT Token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_CONFIG.secret);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

// Hash Password
const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Compare Password
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Generate TOTP secret
const generateTOTPSecret = (userEmail) => {
  return speakeasy.generateSecret({
    name: `${TOTP_CONFIG.name} (${userEmail})`,
    issuer: TOTP_CONFIG.issuer,
    length: 32
  });
};

// Generate QR Code for TOTP setup
const generateQRCode = async (secret) => {
  try {
    return await qrcode.toDataURL(secret.otpauth_url);
  } catch (error) {
    throw new Error('Failed to generate QR code');
  }
};

// Verify TOTP token
const verifyTOTPToken = (token, secret) => {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: TOTP_CONFIG.encoding,
    token: token,
    window: TOTP_CONFIG.window,
    step: TOTP_CONFIG.step
  });
};

// Generate backup recovery codes
const generateRecoveryCodes = (count = 8) => {
  const crypto = require('crypto');
  const codes = [];
  
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  
  return codes;
};

// Hash recovery codes for storage
const hashRecoveryCodes = async (codes) => {
  const hashedCodes = [];
  for (const code of codes) {
    const hashed = await bcrypt.hash(code, 10);
    hashedCodes.push(hashed);
  }
  return hashedCodes;
};

// Verify recovery code
const verifyRecoveryCode = async (inputCode, hashedCodes) => {
  for (let i = 0; i < hashedCodes.length; i++) {
    const isValid = await bcrypt.compare(inputCode.toUpperCase(), hashedCodes[i]);
    if (isValid) {
      return { valid: true, index: i };
    }
  }
  return { valid: false, index: -1 };
};

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

// Middleware to check 2FA requirement
const require2FA = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  // Check if user has 2FA enabled and if the token includes 2FA verification
  if (req.user.twoFactorEnabled && !req.user.twoFactorVerified) {
    return res.status(403).json({ 
      success: false, 
      message: '2FA verification required',
      requiresTwoFactor: true
    });
  }

  next();
};

// Middleware to authorize user roles
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

// Middleware to check specific permissions
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    const userRole = req.user.role;
    const userPermissions = ROLE_PERMISSIONS[userRole] || [];

    // Super admin has all permissions
    if (userRole === USER_ROLES.SUPER_ADMIN || userPermissions.includes('manage_everything')) {
      return next();
    }

    if (!userPermissions.includes(permission)) {
      return res.status(403).json({ 
        success: false, 
        message: `Permission '${permission}' required` 
      });
    }

    next();
  };
};

// Check if user has permission
const hasPermission = (userRole, permission) => {
  if (userRole === USER_ROLES.SUPER_ADMIN) {
    return true;
  }
  
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes(permission) || permissions.includes('manage_everything');
};

// Validate password strength
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  const errors = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Generate secure random string for tokens
const generateSecureToken = (length = 32) => {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('hex');
};

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many login attempts, please try again later'
  },
  register: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 registrations per hour per IP
    message: 'Too many registration attempts, please try again later'
  },
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 password reset attempts per hour
    message: 'Too many password reset attempts, please try again later'
  },
  twoFactor: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 2FA attempts per window
    message: 'Too many 2FA verification attempts, please try again later'
  }
};

module.exports = {
  JWT_CONFIG,
  TOTP_CONFIG,
  TWO_FA_METHODS,
  USER_ROLES,
  ROLE_PERMISSIONS,
  RATE_LIMIT_CONFIG,
  generateToken,
  generateRefreshToken,
  verifyToken,
  hashPassword,
  comparePassword,
  generateTOTPSecret,
  generateQRCode,
  verifyTOTPToken,
  generateRecoveryCodes,
  hashRecoveryCodes,
  verifyRecoveryCode,
  authenticateToken,
  require2FA,
  authorizeRoles,
  requirePermission,
  hasPermission,
  validatePassword,
  generateSecureToken
};