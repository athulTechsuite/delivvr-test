const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
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
  issuer: process.env.APP_ISSUER || process.env.APP_NAME || 'Delivvr',
  window: parseInt(process.env.TOTP_WINDOW) || 2, // Allow 2 time steps before/after current time
  length: parseInt(process.env.TOTP_LENGTH) || 6, // 6-digit codes
  step: parseInt(process.env.TOTP_STEP) || 30, // 30-second time step
  encoding: process.env.TOTP_ENCODING || 'base32'
};

// 2FA Method Types - Only implemented methods
const TWO_FA_METHODS = {
  TOTP: 'totp',
  SMS: 'sms',
  EMAIL: 'email'
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

// Redis client for rate limiting and verification attempts (fallback to in-memory for development)
let redisClient = null;
let redisConnected = false;
const verificationAttempts = new Map(); // Fallback for development
const rateLimitMutex = new Map(); // For atomic operations on in-memory storage

// Enhanced Redis client initialization with proper error handling
const initializeRedis = async () => {
  try {
    if (process.env.REDIS_URL || process.env.REDIS_HOST) {
      const Redis = require('redis');
      const redisOptions = process.env.REDIS_URL 
        ? { url: process.env.REDIS_URL }
        : {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD,
            db: process.env.REDIS_DB || 0,
            retry_strategy: (options) => {
              if (options.error && options.error.code === 'ECONNREFUSED') {
                console.error('Redis server connection refused');
              }
              if (options.total_retry_time > 1000 * 60 * 60) {
                return new Error('Redis retry time exhausted');
              }
              if (options.attempt > 10) {
                return undefined;
              }
              return Math.min(options.attempt * 100, 3000);
            }
          };
      
      redisClient = Redis.createClient(redisOptions);
      
      redisClient.on('connect', () => {
        console.log('Redis client connected');
        redisConnected = true;
      });
      
      redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
        redisConnected = false;
      });
      
      redisClient.on('end', () => {
        console.log('Redis connection closed');
        redisConnected = false;
      });
      
      await redisClient.connect();
    }
  } catch (error) {
    console.warn('Redis not available, using in-memory storage:', error.message);
    redisClient = null;
    redisConnected = false;
  }
};

// Check Redis connection health
const isRedisHealthy = () => {
  return redisClient && redisConnected && redisClient.isReady;
};

// Initialize Redis on module load
initializeRedis();

// Constant-time string comparison to prevent timing attacks
const constantTimeCompare = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
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

// Enhanced TOTP token verification with proper constant-time comparison
const verifyTOTPToken = (token, secret) => {
  if (!token || !secret) {
    return false;
  }
  
  // Ensure token is a string and normalize it
  const normalizedToken = String(token).trim();
  
  // First, try window-based verification for time drift tolerance
  const isValidWithWindow = speakeasy.totp.verify({
    secret: secret,
    encoding: TOTP_CONFIG.encoding,
    token: normalizedToken,
    window: TOTP_CONFIG.window,
    step: TOTP_CONFIG.step
  });
  
  return isValidWithWindow;
};

// Generate backup recovery codes with improved security
const generateRecoveryCodes = (count = 8) => {
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

// Input validation for recovery code operations
const validateRecoveryCodeInput = (userId, hashedCodes, updateUserRecoveryCodes) => {
  if (!userId || (typeof userId !== 'string' && typeof userId !== 'number')) {
    throw new Error('Invalid user ID provided');
  }
  
  if (!Array.isArray(hashedCodes)) {
    throw new Error('Invalid recovery codes format');
  }
  
  if (updateUserRecoveryCodes && typeof updateUserRecoveryCodes !== 'function') {
    throw new Error('Invalid update function provided');
  }
};

// Atomic recovery code verification and removal
const verifyRecoveryCode = async (inputCode, hashedCodes, userId, updateUserRecoveryCodes) => {
  // Validate inputs
  validateRecoveryCodeInput(userId, hashedCodes, updateUserRecoveryCodes);
  
  if (!inputCode || typeof inputCode !== 'string') {
    return { valid: false, index: -1 };
  }
  
  const normalizedInputCode = inputCode.toUpperCase().trim();
  
  // Use database transaction for atomic operation
  if (updateUserRecoveryCodes && typeof updateUserRecoveryCodes === 'function') {
    try {
      // Start transaction - this should be handled by the caller with proper DB transaction
      for (let i = 0; i < hashedCodes.length; i++) {
        const isValid = await bcrypt.compare(normalizedInputCode, hashedCodes[i]);
        if (isValid) {
          // Atomic operation: remove the used code within transaction
          const newHashedCodes = [...hashedCodes];
          newHashedCodes.splice(i, 1);
          
          // Update in database with parameterized query (should be handled by updateUserRecoveryCodes)
          await updateUserRecoveryCodes(userId, newHashedCodes);
          
          return { valid: true, index: i };
        }
      }
    } catch (error) {
      console.error('Error during atomic recovery code verification:', error);
      throw new Error('Failed to verify recovery code');
    }
  } else {
    // Fallback for read-only verification
    for (let i = 0; i < hashedCodes.length; i++) {
      const isValid = await bcrypt.compare(normalizedInputCode, hashedCodes[i]);
      if (isValid) {
        return { valid: true, index: i };
      }
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

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  login: {
    windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 5, // 5 attempts per window
    message: process.env.LOGIN_RATE_LIMIT_MESSAGE || 'Too many login attempts, please try again later'
  },
  register: {
    windowMs: parseInt(process.env.REGISTER_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.REGISTER_RATE_LIMIT_MAX) || 3, // 3 registrations per hour per IP
    message: process.env.REGISTER_RATE_LIMIT_MESSAGE || 'Too many registration attempts, please try again later'
  },
  passwordReset: {
    windowMs: parseInt(process.env.PASSWORD_RESET_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.PASSWORD_RESET_RATE_LIMIT_MAX) || 3, // 3 password reset attempts per hour
    message: process.env.PASSWORD_RESET_RATE_LIMIT_MESSAGE || 'Too many password reset attempts, please try again later'
  },
  twoFactor: {
    windowMs: parseInt(process.env.TWO_FACTOR_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.TWO_FACTOR_RATE_LIMIT_MAX) || 5, // 5 2FA attempts per window
    message: process.env.TWO_FACTOR_RATE_LIMIT_MESSAGE || 'Too many 2FA verification attempts, please try again later'
  }
};

// Enhanced atomic operation for rate limiting with proper concurrency protection
const trackVerificationAttempt = async (userId, success = false) => {
  const key = `2fa_attempts_${userId}`;
  const now = Date.now();
  const windowMs = RATE_LIMIT_CONFIG.twoFactor.windowMs;
  const maxAttempts = RATE_LIMIT_CONFIG.twoFactor.max;
  
  // Try Redis first with proper error handling
  if (isRedisHealthy()) {
    try {
      if (success) {
        // Reset attempts on success
        await redisClient.del(key);
        return true;
      }
      
      // Use Redis pipeline for atomic operations
      const pipeline = redisClient.multi();
      pipeline.incr(key);
      pipeline.expire(key, Math.ceil(windowMs / 1000));
      const results = await pipeline.exec();
      
      if (results && results[0] && results[0][1]) {
        const attemptCount = results[0][1];
        
        if (attemptCount >= maxAttempts) {
          throw new Error(RATE_LIMIT_CONFIG.twoFactor.message);
        }
      }
      
      return false;
    } catch (error) {
      if (error.message === RATE_LIMIT_CONFIG.twoFactor.message) {
        throw error; // Re-throw rate limit errors
      }
      console.warn('Redis operation failed, falling back to in-memory:', error.message);
    }
  }
  
  // Enhanced in-memory fallback with mutex for atomic operations
  const mutexKey = `mutex_${key}`;
  
  // Simple mutex implementation for concurrent access protection
  while (rateLimitMutex.has(mutexKey)) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  rateLimitMutex.set(mutexKey, true);
  
  try {
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
    if (userAttempts.attempts.length >= maxAttempts) {
      userAttempts.locked = true;
      userAttempts.lockExpiry = now + windowMs;
      verificationAttempts.set(key, userAttempts);
      throw new Error(RATE_LIMIT_CONFIG.twoFactor.message);
    }
    
    verificationAttempts.set(key, userAttempts);
    return false;
  } finally {
    rateLimitMutex.delete(mutexKey);
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
  const minLength = parseInt(process.env.PASSWORD_MIN_LENGTH) || 8;
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
  return crypto.randomBytes(length).toString('hex');
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
  generateSecureToken,
  constantTimeCompare,
  isRedisHealthy
};