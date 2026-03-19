const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const User = require('../models/User');
const mongoose = require('mongoose');

// Rate limiting for 2FA attempts
const twoFAAttempts = new Map();

// Generate JWT Token
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Generate backup recovery codes
const generateBackupCodes = () => {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
};

// Hash backup codes for storage
const hashBackupCodes = async (codes) => {
  const hashedCodes = [];
  for (const code of codes) {
    const hashedCode = await bcrypt.hash(code, 10);
    hashedCodes.push(hashedCode);
  }
  return hashedCodes;
};

// Constant-time TOTP verification to prevent timing attacks
const verifyTOTP = (secret, token) => {
  const window = 2;
  const timeStep = Math.floor(Date.now() / 30000);
  let isValid = false;
  
  // Check current time step and surrounding window
  for (let i = -window; i <= window; i++) {
    const testToken = speakeasy.totp({
      secret: secret,
      encoding: 'base32',
      time: (timeStep + i) * 30
    });
    
    // Use crypto.timingSafeEqual for constant-time comparison
    if (testToken.length === token.length) {
      const tokenBuffer = Buffer.from(token);
      const testTokenBuffer = Buffer.from(testToken);
      if (crypto.timingSafeEqual(tokenBuffer, testTokenBuffer)) {
        isValid = true;
      }
    }
  }
  
  return isValid;
};

// Check rate limiting for 2FA attempts
const checkTwoFARateLimit = (userId) => {
  const key = userId.toString();
  const now = Date.now();
  const attempts = twoFAAttempts.get(key) || { count: 0, firstAttempt: now };
  
  // Reset counter if 15 minutes have passed
  if (now - attempts.firstAttempt > 15 * 60 * 1000) {
    attempts.count = 0;
    attempts.firstAttempt = now;
  }
  
  if (attempts.count >= 5) {
    return { allowed: false, remainingTime: 15 * 60 * 1000 - (now - attempts.firstAttempt) };
  }
  
  return { allowed: true };
};

// Atomic increment for failed 2FA attempts using database
const recordFailedTwoFAAttemptAtomic = async (userId) => {
  try {
    // Use atomic increment operation in database to prevent race conditions
    const result = await User.findByIdAndUpdate(
      userId,
      {
        $inc: { 'twoFAFailedAttempts': 1 },
        $setOnInsert: { 'twoFAFirstFailedAttempt': new Date() }
      },
      {
        new: true,
        upsert: false,
        select: 'twoFAFailedAttempts twoFAFirstFailedAttempt'
      }
    );

    if (!result) {
      throw new Error('User not found');
    }

    // Reset counter if 15 minutes have passed
    const now = new Date();
    if (result.twoFAFirstFailedAttempt && 
        (now - result.twoFAFirstFailedAttempt) > 15 * 60 * 1000) {
      await User.findByIdAndUpdate(userId, {
        $set: {
          'twoFAFailedAttempts': 1,
          'twoFAFirstFailedAttempt': now
        }
      });
      return 1;
    }

    // Log failed attempt
    console.warn(`Failed 2FA attempt for user ${userId}. Attempt ${result.twoFAFailedAttempts}/5`);
    
    return result.twoFAFailedAttempts;
  } catch (error) {
    console.error('Error recording failed 2FA attempt:', error);
    // Fallback to memory-based tracking if database operation fails
    return recordFailedTwoFAAttemptMemory(userId);
  }
};

// Fallback memory-based failed attempt recording
const recordFailedTwoFAAttemptMemory = (userId) => {
  const key = userId.toString();
  const now = Date.now();
  const attempts = twoFAAttempts.get(key) || { count: 0, firstAttempt: now };
  
  attempts.count++;
  if (attempts.count === 1) {
    attempts.firstAttempt = now;
  }
  
  twoFAAttempts.set(key, attempts);
  
  // Log failed attempt
  console.warn(`Failed 2FA attempt for user ${userId}. Attempt ${attempts.count}/5 (memory fallback)`);
  
  return attempts.count;
};

// Register new user
exports.register = async (req, res) => {
  try {
    const { name, email, password, role = 'customer' } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Validate role
    const validRoles = ['customer', 'admin', 'vendor'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role,
      isActive: true
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id, user.role);

    // Remove password from response
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      twoFactorEnabled: user.twoFactorEnabled
    };

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
};

// Login user - Step 1: Password verification
exports.login = async (req, res) => {
  try {
    const { email, password, twoFactorCode, useBackupCode = false } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password +twoFactorSecret +backupCodes');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Check if account is locked
    if (user.accountLocked && user.lockUntil && user.lockUntil > new Date()) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to too many failed attempts. Please try again later.'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      // Use atomic increment for failed attempt counter to prevent race conditions
      await User.findByIdAndUpdate(
        user._id,
        { $inc: { 'failedAttempts': 1 } },
        { new: true }
      );
      
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Reset failed attempts counter on successful password verification
    await User.findByIdAndUpdate(
      user._id,
      { $unset: { 'failedAttempts': 1 } },
      { new: true }
    );

    // If 2FA is not enabled, complete login
    if (!user.twoFactorEnabled) {
      // Update last login
      user.lastLogin = new Date();
      await user.save();

      const token = generateToken(user._id, user.role);
      
      const userResponse = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        twoFactorEnabled: user.twoFactorEnabled
      };

      return res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: userResponse,
          token
        }
      });
    }

    // 2FA is enabled - check if code provided
    if (!twoFactorCode) {
      return res.status(200).json({
        success: false,
        requiresTwoFactor: true,
        message: 'Please provide your two-factor authentication code',
        userId: user._id // Temporary identifier for 2FA verification
      });
    }

    // Check rate limiting for 2FA attempts
    const rateLimit = checkTwoFARateLimit(user._id);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        success: false,
        message: 'Too many failed 2FA attempts. Please try again later.',
        retryAfter: Math.ceil(rateLimit.remainingTime / 1000)
      });
    }

    let isValidTwoFactor = false;

    if (useBackupCode) {
      // Verify backup code
      if (user.backupCodes && user.backupCodes.length > 0) {
        for (let i = 0; i < user.backupCodes.length; i++) {
          const isValidBackupCode = await bcrypt.compare(twoFactorCode, user.backupCodes[i]);
          if (isValidBackupCode) {
            // Remove used backup code
            user.backupCodes.splice(i, 1);
            isValidTwoFactor = true;
            break;
          }
        }
      }
    } else {
      // Use constant-time TOTP verification
      isValidTwoFactor = verifyTOTP(user.twoFactorSecret, twoFactorCode);
    }

    if (!isValidTwoFactor) {
      const failedAttempts = await recordFailedTwoFAAttemptAtomic(user._id);
      
      // Lock account after 10 failed 2FA attempts
      if (failedAttempts >= 10) {
        user.accountLocked = true;
        user.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
        await user.save();
        
        // TODO: Send email notification about account lock
        console.warn(`Account locked for user ${user._id} due to excessive failed 2FA attempts`);
        
        return res.status(423).json({
          success: false,
          message: 'Account locked due to too many failed attempts. Please check your email for instructions.'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: useBackupCode ? 'Invalid backup code' : 'Invalid two-factor authentication code',
        attemptsRemaining: 10 - failedAttempts
      });
    }

    // Clear any existing rate limiting
    twoFAAttempts.delete(user._id.toString());
    
    // Reset database-based failed attempt counters
    await User.findByIdAndUpdate(user._id, {
      $unset: {
        'twoFAFailedAttempts': 1,
        'twoFAFirstFailedAttempt': 1
      }
    });

    // Unlock account if it was locked
    if (user.accountLocked) {
      user.accountLocked = false;
      user.lockUntil = undefined;
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id, user.role);

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      twoFactorEnabled: user.twoFactorEnabled
    };

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
};

// Setup 2FA - Generate secret and QR code
exports.setup2FA = async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user.userId;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to enable 2FA'
      });
    }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Check if 2FA is already enabled
    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Two-factor authentication is already enabled'
      });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Delivvr (${user.email})`,
      issuer: 'Delivvr'
    });

    // Generate QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    // Store temporary secret (will be confirmed when user verifies)
    user.twoFactorTempSecret = secret.base32;
    await user.save();

    res.json({
      success: true,
      data: {
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntryKey: secret.base32
      }
    });

  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during 2FA setup'
    });
  }
};

// Verify and enable 2FA
exports.verify2FA = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    const { token } = req.body;
    const userId = req.user.userId;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required'
      });
    }

    await session.withTransaction(async () => {
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.twoFactorTempSecret) {
        throw new Error('No 2FA setup in progress. Please start the setup process first.');
      }

      // Use constant-time TOTP verification
      const isValid = verifyTOTP(user.twoFactorTempSecret, token);

      if (!isValid) {
        throw new Error('Invalid verification code');
      }

      // Generate backup codes
      const backupCodes = generateBackupCodes();
      const hashedBackupCodes = await hashBackupCodes(backupCodes);

      // Enable 2FA with transaction protection
      user.twoFactorEnabled = true;
      user.twoFactorSecret = user.twoFactorTempSecret;
      user.twoFactorTempSecret = undefined;
      user.backupCodes = hashedBackupCodes;
      await user.save({ session });

      // Store backup codes for response
      req.generatedBackupCodes = backupCodes;
    });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Two-factor authentication enabled successfully',
      data: {
        backupCodes: req.generatedBackupCodes
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('2FA verification error:', error);
    
    if (error.message === 'User not found') {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (error.message === 'No 2FA setup in progress. Please start the setup process first.') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message === 'Invalid verification code') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error during 2FA verification'
    });
  } finally {
    await session.endSession();
  }
};

// Disable 2FA
exports.disable2FA = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    const { password, twoFactorCode, useBackupCode = false } = req.body;
    const userId = req.user.userId;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to disable 2FA'
      });
    }

    await session.withTransaction(async () => {
      const user = await User.findById(userId).select('+password +twoFactorSecret +backupCodes').session(session);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.twoFactorEnabled) {
        throw new Error('Two-factor authentication is not enabled');
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new Error('Invalid password');
      }

      // Verify 2FA code or backup code
      if (!twoFactorCode) {
        throw new Error('Two-factor authentication code or backup code is required');
      }

      let isValid = false;

      if (useBackupCode) {
        // Verify backup code
        if (user.backupCodes && user.backupCodes.length > 0) {
          for (const hashedCode of user.backupCodes) {
            if (await bcrypt.compare(twoFactorCode, hashedCode)) {
              isValid = true;
              break;
            }
          }
        }
      } else {
        // Use constant-time TOTP verification
        isValid = verifyTOTP(user.twoFactorSecret, twoFactorCode);
      }

      if (!isValid) {
        throw new Error('Invalid two-factor authentication code');
      }

      // Disable 2FA with transaction protection
      user.twoFactorEnabled = false;
      user.twoFactorSecret = undefined;
      user.backupCodes = [];
      await user.save({ session });
    });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Two-factor authentication disabled successfully'
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Disable 2FA error:', error);
    
    if (error.message === 'User not found') {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (error.message === 'Two-factor authentication is not enabled') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message === 'Invalid password') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message === 'Two-factor authentication code or backup code is required') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message === 'Invalid two-factor authentication code') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error while disabling 2FA'
    });
  } finally {
    await session.endSession();
  }
};

// Regenerate backup codes
exports.regenerateBackupCodes = async (req, res) => {
  try {
    const { password, twoFactorCode } = req.body;
    const userId = req.user.userId;

    if (!password || !twoFactorCode) {
      return res.status(400).json({
        success: false,
        message: 'Password and two-factor authentication code are required'
      });
    }

    const user = await User.findById(userId).select('+password +twoFactorSecret');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Two-factor authentication is not enabled'
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Use constant-time TOTP verification
    const isValidTwoFactor = verifyTOTP(user.twoFactorSecret, twoFactorCode);

    if (!isValidTwoFactor) {
      return res.status(400).json({
        success: false,
        message: 'Invalid two-factor authentication code'
      });
    }

    // Generate new backup codes
    const backupCodes = generateBackupCodes();
    const hashedBackupCodes = await hashBackupCodes(backupCodes);

    user.backupCodes = hashedBackupCodes;
    await user.save();

    res.json({
      success: true,
      message: 'Backup codes regenerated successfully',
      data: {
        backupCodes: backupCodes
      }
    });

  } catch (error) {
    console.error('Regenerate backup codes error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while regenerating backup codes'
    });
  }
};

// Get current user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      twoFactorEnabled: user.twoFactorEnabled,
      hasBackupCodes: user.backupCodes && user.backupCodes.length > 0
    };

    res.json({
      success: true,
      data: { user: userResponse }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.userId;

    const updateData = {};
    if (name) updateData.name = name.trim();

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      twoFactorEnabled: user.twoFactorEnabled
    };

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: userResponse }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current password and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    user.password = hashedNewPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Logout (client-side token removal, but we can track logout server-side if needed)
exports.logout = async (req, res) => {
  try {
    // In a more complex system, you might want to blacklist the token
    // For now, we'll just send a success response
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Verify token (for protected routes)
exports.verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No valid token provided.'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists and is active
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid or expired token.'
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      message: 'Access denied. Invalid token.'
    });
  }
};

// Role-based authorization middleware
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};