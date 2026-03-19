const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const User = require('../models/User');
const { sendEmail } = require('../utils/emailService');
const { sendSMS } = require('../utils/smsService');

// Generate JWT Token
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Generate temporary 2FA token for pending verification
const generateTempToken = (userId) => {
  return jwt.sign(
    { userId, temp2FA: true },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );
};

// Generate backup recovery codes
const generateBackupCodes = () => {
  const codes = [];
  for (let i = 0; i < 8; i++) {
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
      twoFactorEnabled: user.twoFactorEnabled || false
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

// Login user (modified for 2FA support)
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
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password +twoFactorSecret +backupCodes +twoFactorFailedAttempts +twoFactorLockedUntil');
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

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Check if account is temporarily locked due to failed 2FA attempts
      if (user.twoFactorLockedUntil && user.twoFactorLockedUntil > new Date()) {
        const lockTimeRemaining = Math.ceil((user.twoFactorLockedUntil - new Date()) / 60000);
        return res.status(429).json({
          success: false,
          message: `Account temporarily locked due to multiple failed 2FA attempts. Try again in ${lockTimeRemaining} minutes.`,
          lockTimeRemaining
        });
      }

      if (!twoFactorCode) {
        // First step passed, now need 2FA code
        const tempToken = generateTempToken(user._id);
        return res.status(200).json({
          success: false,
          requiresTwoFactor: true,
          message: 'Two-factor authentication code required',
          tempToken,
          smsEnabled: user.smsPhoneNumber ? true : false
        });
      }

      let isValidCode = false;

      if (useBackupCode) {
        // Verify backup code
        if (user.backupCodes && user.backupCodes.length > 0) {
          for (let i = 0; i < user.backupCodes.length; i++) {
            const isValidBackup = await bcrypt.compare(twoFactorCode.toUpperCase(), user.backupCodes[i]);
            if (isValidBackup) {
              isValidCode = true;
              // Remove used backup code
              user.backupCodes.splice(i, 1);
              break;
            }
          }
        }
      } else {
        // Verify TOTP or SMS code
        if (user.twoFactorMethod === 'sms') {
          // For SMS, we would verify against a temporarily stored code
          // This is a simplified implementation
          isValidCode = user.tempSMSCode === twoFactorCode && user.smsCodeExpires > new Date();
        } else {
          // Verify TOTP code
          isValidCode = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: twoFactorCode,
            window: 2
          });
        }
      }

      if (!isValidCode) {
        // Increment failed attempts
        user.twoFactorFailedAttempts = (user.twoFactorFailedAttempts || 0) + 1;
        
        // Lock account after 5 failed attempts for 30 minutes
        if (user.twoFactorFailedAttempts >= 5) {
          user.twoFactorLockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
          user.twoFactorFailedAttempts = 0;
        }
        
        await user.save();
        
        return res.status(401).json({
          success: false,
          message: 'Invalid two-factor authentication code',
          attemptsRemaining: Math.max(0, 5 - user.twoFactorFailedAttempts)
        });
      }

      // Reset failed attempts on successful verification
      user.twoFactorFailedAttempts = 0;
      user.twoFactorLockedUntil = undefined;
      if (user.twoFactorMethod === 'sms') {
        user.tempSMSCode = undefined;
        user.smsCodeExpires = undefined;
      }
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id, user.role);

    // Remove sensitive data from response
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      twoFactorEnabled: user.twoFactorEnabled || false
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

// Send SMS code for 2FA
exports.sendSMSCode = async (req, res) => {
  try {
    const { tempToken } = req.body;

    if (!tempToken) {
      return res.status(400).json({
        success: false,
        message: 'Temporary token required'
      });
    }

    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    if (!decoded.temp2FA) {
      return res.status(400).json({
        success: false,
        message: 'Invalid temporary token'
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user || !user.smsPhoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'SMS not configured for this account'
      });
    }

    // Generate 6-digit SMS code
    const smsCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store code temporarily (expires in 10 minutes)
    user.tempSMSCode = smsCode;
    user.smsCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // Send SMS
    await sendSMS(user.smsPhoneNumber, `Your Delivvr verification code is: ${smsCode}. This code expires in 10 minutes.`);

    res.json({
      success: true,
      message: 'SMS verification code sent'
    });

  } catch (error) {
    console.error('Send SMS code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send SMS code'
    });
  }
};

// Setup 2FA - Generate secret and QR code
exports.setup2FA = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { method = 'totp', phoneNumber } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is already enabled'
      });
    }

    let setupData = {};

    if (method === 'sms') {
      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'Phone number required for SMS 2FA'
        });
      }
      
      user.smsPhoneNumber = phoneNumber;
      user.twoFactorMethod = 'sms';
      setupData.method = 'sms';
      setupData.phoneNumber = phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, '***-***-$3');
      
    } else {
      // Generate secret for TOTP
      const secret = speakeasy.generateSecret({
        name: `Delivvr (${user.email})`,
        issuer: 'Delivvr'
      });

      // Generate QR code
      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

      user.twoFactorSecret = secret.base32;
      user.twoFactorMethod = 'totp';
      
      setupData = {
        method: 'totp',
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntryKey: secret.base32
      };
    }

    // Don't enable 2FA yet - wait for verification
    await user.save();

    res.json({
      success: true,
      message: '2FA setup initiated. Please verify to complete setup.',
      data: setupData
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
  try {
    const userId = req.user.userId;
    const { verificationCode } = req.body;

    if (!verificationCode) {
      return res.status(400).json({
        success: false,
        message: 'Verification code is required'
      });
    }

    const user = await User.findById(userId).select('+twoFactorSecret');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is already enabled'
      });
    }

    let isValidCode = false;

    if (user.twoFactorMethod === 'sms') {
      // For SMS, verify the code sent to phone
      isValidCode = user.tempSMSCode === verificationCode && user.smsCodeExpires > new Date();
    } else {
      // Verify TOTP code
      if (!user.twoFactorSecret) {
        return res.status(400).json({
          success: false,
          message: '2FA setup not initiated'
        });
      }

      isValidCode = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: verificationCode,
        window: 2
      });
    }

    if (!isValidCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes();
    const hashedBackupCodes = await hashBackupCodes(backupCodes);

    // Enable 2FA
    user.twoFactorEnabled = true;
    user.backupCodes = hashedBackupCodes;
    user.twoFactorEnabledAt = new Date();
    
    // Clear temporary SMS data
    user.tempSMSCode = undefined;
    user.smsCodeExpires = undefined;

    await user.save();

    // Send email notification
    try {
      await sendEmail(
        user.email,
        '2FA Enabled on Your Account',
        `Two-factor authentication has been successfully enabled on your Delivvr account. If you didn't make this change, please contact support immediately.`
      );
    } catch (emailError) {
      console.error('Failed to send 2FA enabled email:', emailError);
    }

    res.json({
      success: true,
      message: '2FA enabled successfully',
      data: {
        backupCodes: backupCodes,
        message: 'Save these backup codes in a safe place. They can be used to access your account if you lose your 2FA device.'
      }
    });

  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during 2FA verification'
    });
  }
};

// Disable 2FA
exports.disable2FA = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { password, twoFactorCode } = req.body;

    if (!password || !twoFactorCode) {
      return res.status(400).json({
        success: false,
        message: 'Password and 2FA code are required'
      });
    }

    const user = await User.findById(userId).select('+password +twoFactorSecret +backupCodes');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is not enabled'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Verify 2FA code
    let isValidCode = false;

    if (user.twoFactorMethod === 'sms') {
      isValidCode = user.tempSMSCode === twoFactorCode && user.smsCodeExpires > new Date();
    } else {
      isValidCode = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 2
      });
    }

    if (!isValidCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid 2FA code'
      });
    }

    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorMethod = undefined;
    user.backupCodes = [];
    user.smsPhoneNumber = undefined;
    user.twoFactorFailedAttempts = 0;
    user.twoFactorLockedUntil = undefined;
    user.tempSMSCode = undefined;
    user.smsCodeExpires = undefined;

    await user.save();

    // Send email notification
    try {
      await sendEmail(
        user.email,
        '2FA Disabled on Your Account',
        `Two-factor authentication has been disabled on your Delivvr account. If you didn't make this change, please contact support immediately and consider re-enabling 2FA for better security.`
      );
    } catch (emailError) {
      console.error('Failed to send 2FA disabled email:', emailError);
    }

    res.json({
      success: true,
      message: '2FA disabled successfully'
    });

  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while disabling 2FA'
    });
  }
};

// Regenerate backup codes
exports.regenerateBackupCodes = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { twoFactorCode } = req.body;

    if (!twoFactorCode) {
      return res.status(400).json({
        success: false,
        message: '2FA code is required'
      });
    }

    const user = await User.findById(userId).select('+twoFactorSecret');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is not enabled'
      });
    }

    // Verify 2FA code
    let isValidCode = false;

    if (user.twoFactorMethod === 'sms') {
      isValidCode = user.tempSMSCode === twoFactorCode && user.smsCodeExpires > new Date();
    } else {
      isValidCode = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 2
      });
    }

    if (!isValidCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid 2FA code'
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
        backupCodes: backupCodes,
        message: 'Your old backup codes are no longer valid. Save these new codes in a safe place.'
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

// Get 2FA status
exports.get2FAStatus = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        twoFactorEnabled: user.twoFactorEnabled || false,
        method: user.twoFactorMethod || null,
        enabledAt: user.twoFactorEnabledAt || null,
        backupCodesRemaining: user.backupCodes ? user.backupCodes.length : 0,
        hasPhoneNumber: user.smsPhoneNumber ? true : false
      }
    });

  } catch (error) {
    console.error('Get 2FA status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
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
      twoFactorEnabled: user.twoFactorEnabled || false
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
      twoFactorEnabled: user.twoFactorEnabled || false
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