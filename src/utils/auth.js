import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import speakeasy from 'speakeasy';

// JWT Secret - In production, this should be an environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
const JWT_EXPIRY = '7d';

// User roles enum
export const USER_ROLES = {
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  VENDOR: 'vendor'
};

// 2FA Constants
export const TWO_FA_TYPES = {
  TOTP: 'totp',
  SMS: 'sms'
};

export const TWO_FA_LOCKOUT = {
  MAX_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000 // 15 minutes
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
export const generateTempToken = (userId, email, role) => {
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

// Generate 2FA secret for TOTP
export const generate2FASecret = (userEmail, serviceName = 'Delivvr') => {
  const secret = speakeasy.generateSecret({
    name: userEmail,
    issuer: serviceName,
    length: 32
  });
  
  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url,
    qrCode: secret.otpauth_url
  };
};

// Verify TOTP code
export const verifyTOTP = (token, secret, window = 1) => {
  try {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: window
    });
  } catch (error) {
    return false;
  }
};

// Generate backup recovery codes
export const generateRecoveryCodes = (count = 8) => {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
};

// Hash recovery code for storage
export const hashRecoveryCode = (code) => {
  return crypto.createHash('sha256').update(code.toLowerCase().replace('-', '')).digest('hex');
};

// Verify recovery code
export const verifyRecoveryCode = (inputCode, hashedCode) => {
  const hashedInput = hashRecoveryCode(inputCode);
  return hashedInput === hashedCode;
};

// Generate SMS verification code
export const generateSMSCode = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Store token in localStorage
export const storeToken = (token) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('authToken', token);
  }
};

// Store temp 2FA token
export const storeTempToken = (token) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('temp2FAToken', token);
  }
};

// Get token from localStorage
export const getStoredToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('authToken');
  }
  return null;
};

// Get temp 2FA token
export const getTempToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('temp2FAToken');
  }
  return null;
};

// Remove token from localStorage
export const removeStoredToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('authToken');
    localStorage.removeItem('temp2FAToken');
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

// Get user from temp 2FA token
export const getTempUser = () => {
  const token = getTempToken();
  if (!token) return null;
  
  try {
    const decoded = decodeToken(token);
    if (!decoded || decoded.exp < Date.now() / 1000 || !decoded.temp2FA) {
      return null;
    }
    return decoded;
  } catch (error) {
    return null;
  }
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

// Email validation utility
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate 2FA code format
export const validate2FACode = (code) => {
  // TOTP codes are typically 6 digits
  const totpRegex = /^\d{6}$/;
  // Recovery codes are 8 characters with dash (XXXX-XXXX)
  const recoveryRegex = /^[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}$/;
  
  return totpRegex.test(code) || recoveryRegex.test(code);
};

// Auth middleware for API routes
export const authMiddleware = (requiredRoles = null, allow2FABypass = false) => {
  return (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
      }
      
      const decoded = verifyToken(token);
      req.user = decoded;
      
      // Check if 2FA is required and not bypassed
      if (decoded.requires2FA && !allow2FABypass) {
        return res.status(403).json({ 
          error: 'Two-factor authentication required.',
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

// 2FA middleware for temp token verification
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
      res.status(401).json({ error: 'Invalid token.' });
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

// Protected route wrapper for client-side routing
export const withAuth = (WrappedComponent, allowedRoles = null) => {
  return function AuthenticatedComponent(props) {
    const user = getCurrentUser();
    
    if (!user) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return null;
    }
    
    // Check if 2FA verification is required
    if (user.requires2FA) {
      if (typeof window !== 'undefined') {
        window.location.href = '/verify-2fa';
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

// Check if account is locked due to 2FA failures
export const isAccountLocked = (failedAttempts, lastFailedAttempt) => {
  if (failedAttempts < TWO_FA_LOCKOUT.MAX_ATTEMPTS) {
    return false;
  }
  
  const lockoutExpiry = new Date(lastFailedAttempt).getTime() + TWO_FA_LOCKOUT.LOCKOUT_DURATION;
  return Date.now() < lockoutExpiry;
};

// Calculate remaining lockout time
export const getRemainingLockoutTime = (lastFailedAttempt) => {
  const lockoutExpiry = new Date(lastFailedAttempt).getTime() + TWO_FA_LOCKOUT.LOCKOUT_DURATION;
  const remaining = lockoutExpiry - Date.now();
  return Math.max(0, Math.ceil(remaining / 1000 / 60)); // Return minutes
};

export default {
  generateToken,
  generateTempToken,
  verifyToken,
  decodeToken,
  hasRole,
  isAdmin,
  isVendor,
  isCustomer,
  generate2FASecret,
  verifyTOTP,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyRecoveryCode,
  generateSMSCode,
  storeToken,
  storeTempToken,
  getStoredToken,
  getTempToken,
  removeStoredToken,
  getCurrentUser,
  getTempUser,
  isAuthenticated,
  requires2FAVerification,
  logout,
  validatePassword,
  validateEmail,
  validate2FACode,
  authMiddleware,
  temp2FAMiddleware,
  getDashboardRoute,
  withAuth,
  isAccountLocked,
  getRemainingLockoutTime,
  USER_ROLES,
  TWO_FA_TYPES,
  TWO_FA_LOCKOUT
};