import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

// JWT Secret - In production, this should be an environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
const JWT_EXPIRY = '7d';

// User roles enum
export const USER_ROLES = {
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  VENDOR: 'vendor'
};

// 2FA Configuration
export const TWO_FA_CONFIG = {
  SERVICE_NAME: 'Delivvr',
  BACKUP_CODES_COUNT: 10,
  BACKUP_CODE_LENGTH: 8,
  TOTP_WINDOW: 1, // Allow 1 step before/after for clock skew
  QR_CODE_SIZE: 200
};

// Generate JWT token
export const generateToken = (userId, email, role, requires2FA = false) => {
  const payload = {
    userId,
    email,
    role,
    requires2FA,
    iat: Date.now()
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

// Generate temporary 2FA token (short-lived)
export const generate2FAToken = (userId, email, role) => {
  const payload = {
    userId,
    email,
    role,
    temp2FA: true,
    iat: Date.now()
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '10m' });
};

// Verify JWT token
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

// Decode token without verification (for client-side use)
export const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

// Generate 2FA secret
export const generate2FASecret = (email) => {
  return speakeasy.generateSecret({
    name: `${TWO_FA_CONFIG.SERVICE_NAME} (${email})`,
    issuer: TWO_FA_CONFIG.SERVICE_NAME,
    length: 32
  });
};

// Generate QR code for 2FA setup
export const generate2FAQRCode = async (secret) => {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url, {
      width: TWO_FA_CONFIG.QR_CODE_SIZE,
      margin: 2
    });
    return qrCodeDataUrl;
  } catch (error) {
    throw new Error('Failed to generate QR code');
  }
};

// Verify 2FA token
export const verify2FAToken = (secret, token) => {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: TWO_FA_CONFIG.TOTP_WINDOW
  });
};

// Generate backup codes
export const generateBackupCodes = (count = TWO_FA_CONFIG.BACKUP_CODES_COUNT) => {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(TWO_FA_CONFIG.BACKUP_CODE_LENGTH / 2).toString('hex');
    codes.push(code.toUpperCase());
  }
  return codes;
};

// Hash backup codes for secure storage
export const hashBackupCodes = (codes) => {
  return codes.map(code => ({
    hash: crypto.createHash('sha256').update(code).digest('hex'),
    used: false
  }));
};

// Verify backup code
export const verifyBackupCode = (code, hashedCodes) => {
  const codeHash = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
  return hashedCodes.find(bc => bc.hash === codeHash && !bc.used);
};

// Mark backup code as used
export const markBackupCodeUsed = (code, hashedCodes) => {
  const codeHash = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
  const backupCode = hashedCodes.find(bc => bc.hash === codeHash);
  if (backupCode) {
    backupCode.used = true;
  }
  return hashedCodes;
};

// Format backup codes for display (add dashes)
export const formatBackupCodes = (codes) => {
  return codes.map(code => {
    return code.match(/.{1,4}/g).join('-');
  });
};

// Check if user has required role
export const hasRole = (userRole, requiredRole) => {
  if (Array.isArray(requiredRole)) {
    return requiredRole.includes(userRole);
  }
  return userRole === requiredRole;
};

// Check if user has admin privileges
export const isAdmin = (userRole) => {
  return userRole === USER_ROLES.ADMIN;
};

// Check if user has vendor privileges
export const isVendor = (userRole) => {
  return userRole === USER_ROLES.VENDOR || userRole === USER_ROLES.ADMIN;
};

// Check if user has customer privileges
export const isCustomer = (userRole) => {
  return Object.values(USER_ROLES).includes(userRole);
};

// Store token in localStorage
export const storeToken = (token) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('authToken', token);
  }
};

// Get token from localStorage
export const getStoredToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('authToken');
  }
  return null;
};

// Remove token from localStorage
export const removeStoredToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('authToken');
  }
};

// Get current user from stored token
export const getCurrentUser = () => {
  const token = getStoredToken();
  if (!token) return null;
  
  try {
    const decoded = decodeToken(token);
    if (!decoded || decoded.exp < Date.now() / 1000) {
      removeStoredToken();
      return null;
    }
    return decoded;
  } catch (error) {
    removeStoredToken();
    return null;
  }
};

// Check if user is authenticated
export const isAuthenticated = () => {
  const user = getCurrentUser();
  return !!user && !user.requires2FA;
};

// Check if user needs 2FA verification
export const requires2FAVerification = () => {
  const user = getCurrentUser();
  return !!user && user.requires2FA;
};

// Logout user
export const logout = () => {
  removeStoredToken();
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
};

// Password validation utility
export const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
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

// 2FA code validation utility
export const validate2FACode = (code) => {
  if (!code) {
    return { isValid: false, error: '2FA code is required' };
  }
  
  const cleanCode = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(cleanCode)) {
    return { isValid: false, error: '2FA code must be 6 digits' };
  }
  
  return { isValid: true, code: cleanCode };
};

// Backup code validation utility
export const validateBackupCode = (code) => {
  if (!code) {
    return { isValid: false, error: 'Backup code is required' };
  }
  
  const cleanCode = code.replace(/[-\s]/g, '').toUpperCase();
  if (!/^[A-F0-9]{8}$/.test(cleanCode)) {
    return { isValid: false, error: 'Invalid backup code format' };
  }
  
  return { isValid: true, code: cleanCode };
};

// Email validation utility
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Enhanced auth middleware for API routes with 2FA support
export const authMiddleware = (requiredRoles = null, skip2FA = false) => {
  return (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
      }
      
      const decoded = verifyToken(token);
      req.user = decoded;
      
      // Check if 2FA is required and not skipped
      if (!skip2FA && decoded.requires2FA) {
        return res.status(401).json({ 
          error: '2FA verification required',
          requires2FA: true
        });
      }
      
      // Check role permissions if required
      if (requiredRoles && !hasRole(decoded.role, requiredRoles)) {
        return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
      }
      
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid token.' });
    }
  };
};

// 2FA middleware for temporary tokens
export const temp2FAMiddleware = () => {
  return (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
      }
      
      const decoded = verifyToken(token);
      
      if (!decoded.temp2FA) {
        return res.status(401).json({ error: 'Invalid temporary token.' });
      }
      
      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid temporary token.' });
    }
  };
};

// Get dashboard route based on user role
export const getDashboardRoute = (role) => {
  switch (role) {
    case USER_ROLES.ADMIN:
      return '/admin/dashboard';
    case USER_ROLES.VENDOR:
      return '/vendor/dashboard';
    case USER_ROLES.CUSTOMER:
      return '/customer/dashboard';
    default:
      return '/login';
  }
};

// Protected route wrapper for client-side routing with 2FA support
export const withAuth = (WrappedComponent, allowedRoles = null) => {
  return function AuthenticatedComponent(props) {
    const user = getCurrentUser();
    
    if (!user) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return null;
    }
    
    // Check if 2FA is required
    if (user.requires2FA) {
      if (typeof window !== 'undefined') {
        window.location.href = '/2fa-verify';
      }
      return null;
    }
    
    if (allowedRoles && !hasRole(user.role, allowedRoles)) {
      if (typeof window !== 'undefined') {
        window.location.href = '/unauthorized';
      }
      return null;
    }
    
    return <WrappedComponent {...props} user={user} />;
  };
};

export default {
  generateToken,
  generate2FAToken,
  verifyToken,
  decodeToken,
  generate2FASecret,
  generate2FAQRCode,
  verify2FAToken,
  generateBackupCodes,
  hashBackupCodes,
  verifyBackupCode,
  markBackupCodeUsed,
  formatBackupCodes,
  hasRole,
  isAdmin,
  isVendor,
  isCustomer,
  storeToken,
  getStoredToken,
  removeStoredToken,
  getCurrentUser,
  isAuthenticated,
  requires2FAVerification,
  logout,
  validatePassword,
  validate2FACode,
  validateBackupCode,
  validateEmail,
  authMiddleware,
  temp2FAMiddleware,
  getDashboardRoute,
  withAuth,
  USER_ROLES,
  TWO_FA_CONFIG
};