import jwt from 'jsonwebtoken';

// JWT Secret - In production, this should be an environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
const JWT_EXPIRY = '7d';

// User roles enum
export const USER_ROLES = {
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  VENDOR: 'vendor'
};

// Generate JWT token
export const generateToken = (userId, email, role) => {
  const payload = {
    userId,
    email,
    role,
    iat: Date.now()
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
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
  return !!user;
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

// Auth middleware for API routes
export const authMiddleware = (requiredRoles = null) => {
  return (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
      }
      
      const decoded = verifyToken(token);
      req.user = decoded;
      
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
  verifyToken,
  decodeToken,
  hasRole,
  isAdmin,
  isVendor,
  isCustomer,
  storeToken,
  getStoredToken,
  removeStoredToken,
  getCurrentUser,
  isAuthenticated,
  logout,
  validatePassword,
  validateEmail,
  authMiddleware,
  getDashboardRoute,
  withAuth,
  USER_ROLES
};