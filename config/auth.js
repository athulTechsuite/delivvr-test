const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const emailService = require('../services/emailService');

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

// Validate 2FA method
const isValidTwoFAMethod = (method) => {
  return Object.values(TWO_FA_METHODS).includes(method);
};

// Get default method for unknown types
const getDefaultTwoFAMethod = () => {
  return TWO_FA_METHODS.TOTP;
};

// Validate and sanitize 2FA method
const validateTwoFAMethod = (method) => {
  if (!method) {
    return getDefaultTwoFAMethod();
  }
  
  if (isValidTwoFAMethod(method)) {
    return method;
  }
  
  throw new Error(`Invalid 2FA method: ${method}. Supported methods: ${Object.values(TWO_FA_METHODS).join(', ')}`);
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

// In-memory store for concurrent operation tracking
const verificationAttempts = new Map();

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

// Validate current password for 2FA operations
const validateCurrentPassword = async (userId, currentPassword, hashedPassword) => {
  if (!currentPassword) {
    throw new Error('Current password is required for 2FA operations');
  }
  
  const isValid = await comparePassword(currentPassword, hashedPassword);
  if (!isValid) {
    throw new Error('Invalid current password');
  }
  
  return true;
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

// Generate backup recovery codes with improved security
const generateRecoveryCodes = (count = 8) => {
  const crypto = require('crypto');
  const codes = [];
  
  for (let i = 0; i < count; i++) {
    // Generate 16-character alphanumeric code (8 bytes = 16 hex chars) for better security
    const code = crypto.randomBytes(8).toString('hex').toUpperCase();
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

// Regenerate recovery codes with validation
const regenerateRecoveryCodes = async (userId, currentPassword, userHashedPassword, twoFactorCode, userSecret) => {
  // Validate current password
  await validateCurrentPassword(userId, currentPassword, userHashedPassword);
  
  // Validate 2FA code
  const isTwoFactorValid = verifyTOTPToken(twoFactorCode, userSecret);
  if (!isTwoFactorValid) {
    throw new Error('Invalid 2FA code');
  }
  
  // Generate new recovery codes
  const newCodes = generateRecoveryCodes();
  const hashedCodes = await hashRecoveryCodes(newCodes);
  
  return {
    codes: newCodes,
    hashedCodes: hashedCodes
  };
};

// Send 2FA status change notification
const send2FANotification = async (userEmail, userName, action, ipAddress = null) => {
  try {
    const subject = action === 'enabled' 
      ? '2FA Enabled on Your Account'
      : '2FA Disabled on Your Account';
    
    const message = `
      Hi ${userName},
      
      Two-Factor Authentication has been ${action} on your account.
      
      ${ipAddress ? `IP Address: ${ipAddress}` : ''}
      Time: ${new Date().toISOString()}
      
      If you didn't make this change, please contact support immediately.
      
      Best regards,
      ${TOTP_CONFIG.name} Security Team
    `;
    
    await emailService.sendEmail({
      to: userEmail,
      subject: subject,
      text: message
    });
  } catch (error) {
    console.error('Failed to send 2FA notification email:', error);
    // Don't throw error as this shouldn't block the 2FA operation
  }
};

// Enable 2FA with full validation and notification
const enable2FA = async (userId, userEmail, userName, currentPassword, userHashedPassword, ipAddress = null) => {
  // Validate current password
  await validateCurrentPassword(userId, currentPassword, userHashedPassword);
  
  // Generate TOTP secret and recovery codes
  const secret = generateTOTPSecret(userEmail);
  const recoveryCodes = generateRecoveryCodes();
  const hashedRecoveryCodes = await hashRecoveryCodes(recoveryCodes);
  
  // Send notification email
  await send2FANotification(userEmail, userName, 'enabled', ipAddress);
  
  return {
    secret: secret,
    recoveryCodes: recoveryCodes,
    hashedRecoveryCodes: hashedRecoveryCodes
  };
};

// Disable 2FA with full validation and notification
const disable2FA = async (userId, userEmail, userName, currentPassword, userHashedPassword, twoFactorCode, userSecret, ipAddress = null) => {
  // Validate current password
  await validateCurrentPassword(userId, currentPassword, userHashedPassword);
  
  // Validate 2FA code
  const isTwoFactorValid = verifyTOTPToken(twoFactorCode, userSecret);
  if (!isTwoFactorValid) {
    throw new Error('Invalid 2FA code');
  }
  
  // Send notification email
  await send2FANotification(userEmail, userName, 'disabled', ipAddress);
  
  return true;
};

// Atomic operation for failed attempt tracking
const trackVerificationAttempt = async (userId, success = false) => {
  const key = `2fa_attempts_${userId}`;
  const now = Date.now();
  const windowMs = RATE_LIMIT_CONFIG.twoFactor.windowMs;
  
  if (!verificationAttempts.has(key)) {
    verificationAttempts.set(key, { attempts: [], locked: false });
  }
  
  const userAttempts = verificationAttempts.get(key);
  
  // Check if currently locked
  if (userAttempts.locked) {
    const lockExpiry = userAttempts.lockExpiry || 0;
    if (now < lockExpiry) {
      throw new Error('Account temporarily locked due to too many failed 2FA attempts');
    } else {
      // Reset lock
      userAttempts.locked = false;
      userAttempts.attempts = [];
    }
  }
  
  // Clean old attempts outside window
  userAttempts.attempts = userAttempts.attempts.filter(attempt => 
    now - attempt.timestamp < windowMs
  );
  
  if (success) {
    // Reset on successful verification
    userAttempts.attempts = [];
    verificationAttempts.set(key, userAttempts);
    return true;
  }
  
  // Track failed attempt
  userAttempts.attempts.push({ timestamp: now, success: false });
  
  // Check if limit exceeded
  if (userAttempts.attempts.length >= RATE_LIMIT_CONFIG.twoFactor.max) {
    userAttempts.locked = true;
    userAttempts.lockExpiry = now + windowMs;
    verificationAttempts.set(key, userAttempts);
    throw new Error(RATE_LIMIT_CONFIG.twoFactor.message);
  }
  
  verificationAttempts.set(key, userAttempts);
  return false;
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

// Enhanced 2FA verification middleware with concurrency protection
const require2FA = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  // Check if user has 2FA enabled and if the token includes 2FA verification
  if (req.user.twoFactorEnabled && !req.user.twoFactorVerified) {
    try {
      // Track verification attempt for rate limiting
      await trackVerificationAttempt(req.user.id, false);
    } catch (error) {
      return res.status(429).json({
        success: false,
        message: error.message
      });
    }
    
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
  validateCurrentPassword,
  generateTOTPSecret,
  generateQRCode,
  verifyTOTPToken,
  generateRecoveryCodes,
  hashRecoveryCodes,
  verifyRecoveryCode,
  regenerateRecoveryCodes,
  send2FANotification,
  enable2FA,
  disable2FA,
  trackVerificationAttempt,
  isValidTwoFAMethod,
  validateTwoFAMethod,
  getDefaultTwoFAMethod,
  authenticateToken,
  require2FA,
  authorizeRoles,
  requirePermission,
  hasPermission,
  validatePassword,
  generateSecureToken
};