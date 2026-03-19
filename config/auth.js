const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

// Validate JWT secret is properly configured
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required and must be set');
}

// Validate encryption key for 2FA secrets
if (!process.env.ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required for 2FA secret encryption');
}

// JWT Configuration
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
};

// 2FA Configuration
const TWO_FA_CONFIG = {
  serviceName: process.env.APP_NAME || 'Delivvr',
  window: 1, // Allow 1 window before and after current window (30 seconds each)
  step: 30, // 30 second time step
  encoding: 'base32',
  backupCodeLength: 8,
  backupCodeCount: 10
};

// Encryption configuration for 2FA secrets
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 16,
  tagLength: 16
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
    'update_profile',
    'manage_2fa'
  ],
  [USER_ROLES.VENDOR]: [
    'view_products',
    'manage_own_products',
    'view_own_orders',
    'manage_inventory',
    'view_sales_analytics',
    'update_profile',
    'manage_2fa'
  ],
  [USER_ROLES.ADMIN]: [
    'view_products',
    'manage_all_products',
    'manage_users',
    'view_all_orders',
    'manage_categories',
    'view_analytics',
    'manage_vendors',
    'update_profile',
    'manage_2fa'
  ],
  [USER_ROLES.SUPER_ADMIN]: [
    'manage_everything',
    'manage_admins',
    'system_settings',
    'view_system_logs',
    'manage_2fa'
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

// Encrypt 2FA Secret
const encrypt2FASecret = (secret) => {
  try {
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
    const cipher = crypto.createCipher(ENCRYPTION_CONFIG.algorithm, key);
    cipher.setAAD(Buffer.from('2fa-secret', 'utf8'));
    
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  } catch (error) {
    throw new Error('Failed to encrypt 2FA secret');
  }
};

// Decrypt 2FA Secret
const decrypt2FASecret = (encryptedData) => {
  try {
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const tag = Buffer.from(encryptedData.tag, 'hex');
    
    const decipher = crypto.createDecipher(ENCRYPTION_CONFIG.algorithm, key);
    decipher.setAAD(Buffer.from('2fa-secret', 'utf8'));
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Failed to decrypt 2FA secret');
  }
};

// Generate 2FA Secret
const generate2FASecret = (userEmail) => {
  return speakeasy.generateSecret({
    name: `${TWO_FA_CONFIG.serviceName} (${userEmail})`,
    service: TWO_FA_CONFIG.serviceName,
    length: 32,
    encoding: TWO_FA_CONFIG.encoding
  });
};

// Generate QR Code for 2FA Setup
const generate2FAQRCode = async (secret) => {
  try {
    return await qrcode.toDataURL(secret.otpauth_url);
  } catch (error) {
    throw new Error('Failed to generate QR code');
  }
};

// Verify 2FA Token
const verify2FAToken = (token, secret) => {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: TWO_FA_CONFIG.encoding,
    token: token,
    step: TWO_FA_CONFIG.step,
    window: TWO_FA_CONFIG.window
  });
};

// Generate Backup Codes
const generateBackupCodes = () => {
  const codes = [];
  for (let i = 0; i < TWO_FA_CONFIG.backupCodeCount; i++) {
    codes.push(crypto.randomBytes(TWO_FA_CONFIG.backupCodeLength).toString('hex').toUpperCase());
  }
  return codes;
};

// Hash Backup Codes
const hashBackupCodes = async (codes) => {
  const hashedCodes = [];
  for (const code of codes) {
    hashedCodes.push(await bcrypt.hash(code, 10));
  }
  return hashedCodes;
};

// Verify Backup Code
const verifyBackupCode = async (inputCode, hashedCodes) => {
  for (let i = 0; i < hashedCodes.length; i++) {
    if (hashedCodes[i] && await bcrypt.compare(inputCode, hashedCodes[i])) {
      return i; // Return index of used backup code
    }
  }
  return -1; // No match found
};

// Send 2FA status change email notification
const send2FANotificationEmail = async (userEmail, userName, action, ipAddress) => {
  try {
    const emailService = require('../services/emailService');
    const subject = `${TWO_FA_CONFIG.serviceName} - Two-Factor Authentication ${action === 'enabled' ? 'Enabled' : 'Disabled'}`;
    
    const emailTemplate = `
      <h2>Two-Factor Authentication ${action === 'enabled' ? 'Enabled' : 'Disabled'}</h2>
      <p>Hello ${userName},</p>
      <p>Two-factor authentication has been <strong>${action}</strong> on your ${TWO_FA_CONFIG.serviceName} account.</p>
      <p><strong>Details:</strong></p>
      <ul>
        <li>Time: ${new Date().toLocaleString()}</li>
        <li>IP Address: ${ipAddress}</li>
        <li>Action: 2FA ${action}</li>
      </ul>
      <p>If you did not make this change, please contact our support team immediately.</p>
      <p>Best regards,<br>The ${TWO_FA_CONFIG.serviceName} Team</p>
    `;

    await emailService.sendEmail({
      to: userEmail,
      subject,
      html: emailTemplate
    });
  } catch (error) {
    console.error('Failed to send 2FA notification email:', error);
    // Don't throw error to prevent blocking the main 2FA operation
  }
};

// Setup 2FA for user
const setup2FAForUser = async (userId, userEmail, userName, ipAddress) => {
  try {
    const secret = generate2FASecret(userEmail);
    const qrCode = await generate2FAQRCode(secret);
    const backupCodes = generateBackupCodes();
    const hashedBackupCodes = await hashBackupCodes(backupCodes);
    
    // Encrypt the secret before storing
    const encryptedSecret = encrypt2FASecret(secret.base32);
    
    return {
      secret: encryptedSecret,
      qrCode,
      backupCodes,
      hashedBackupCodes,
      manualEntryKey: secret.base32
    };
  } catch (error) {
    throw new Error('Failed to setup 2FA: ' + error.message);
  }
};

// Enable 2FA for user
const enable2FAForUser = async (userId, userEmail, userName, ipAddress) => {
  try {
    // Send notification email
    await send2FANotificationEmail(userEmail, userName, 'enabled', ipAddress);
    return { success: true, message: '2FA has been enabled successfully' };
  } catch (error) {
    throw new Error('Failed to enable 2FA: ' + error.message);
  }
};

// Disable 2FA for user
const disable2FAForUser = async (userId, userEmail, userName, token, ipAddress) => {
  try {
    // Validate the 2FA token or backup code before disabling
    const validation = validate2FAToken(token);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // Send notification email
    await send2FANotificationEmail(userEmail, userName, 'disabled', ipAddress);
    
    return { success: true, message: '2FA has been disabled successfully' };
  } catch (error) {
    throw new Error('Failed to disable 2FA: ' + error.message);
  }
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

// Rate limiting middleware for 2FA attempts
const twoFactorRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window per IP
  message: {
    success: false,
    message: 'Too many 2FA verification attempts. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use both IP and user ID if available for more granular rate limiting
    return req.user ? `2fa_${req.ip}_${req.user.id}` : `2fa_${req.ip}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many 2FA verification attempts. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Rate limiting middleware for 2FA setup attempts
const twoFactorSetupRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 setup attempts per hour
  message: {
    success: false,
    message: 'Too many 2FA setup attempts. Please try again later.',
    retryAfter: '1 hour'
  },
  keyGenerator: (req) => {
    return req.user ? `2fa_setup_${req.user.id}` : `2fa_setup_${req.ip}`;
  }
});

// Middleware to check 2FA requirement
const require2FA = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  // If user has 2FA enabled but token doesn't indicate 2FA verification
  if (req.user.twoFactorEnabled && !req.user.twoFactorVerified) {
    return res.status(403).json({ 
      success: false, 
      message: 'Two-factor authentication required',
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

// Validate 2FA Token Format
const validate2FAToken = (token) => {
  if (!token) {
    return { isValid: false, error: '2FA code is required' };
  }

  if (typeof token !== 'string') {
    return { isValid: false, error: '2FA code must be a string' };
  }

  // Remove spaces and check if it's 6 digits
  const cleanToken = token.replace(/\s/g, '');
  if (!/^\d{6}$/.test(cleanToken)) {
    return { isValid: false, error: '2FA code must be exactly 6 digits' };
  }

  return { isValid: true, cleanToken };
};

// Generate secure random string for tokens
const generateSecureToken = (length = 32) => {
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
  },
  twoFactorSetup: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 2FA setup attempts per hour
    message: 'Too many 2FA setup attempts, please try again later'
  },
  twoFactorDisable: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 2, // 2 2FA disable attempts per hour
    message: 'Too many 2FA disable attempts, please try again later'
  }
};

module.exports = {
  JWT_CONFIG,
  TWO_FA_CONFIG,
  USER_ROLES,
  ROLE_PERMISSIONS,
  RATE_LIMIT_CONFIG,
  ENCRYPTION_CONFIG,
  generateToken,
  generateRefreshToken,
  verifyToken,
  hashPassword,
  comparePassword,
  encrypt2FASecret,
  decrypt2FASecret,
  generate2FASecret,
  generate2FAQRCode,
  verify2FAToken,
  generateBackupCodes,
  hashBackupCodes,
  verifyBackupCode,
  setup2FAForUser,
  enable2FAForUser,
  disable2FAForUser,
  send2FANotificationEmail,
  authenticateToken,
  twoFactorRateLimit,
  twoFactorSetupRateLimit,
  require2FA,
  authorizeRoles,
  requirePermission,
  hasPermission,
  validatePassword,
  validate2FAToken,
  generateSecureToken
};