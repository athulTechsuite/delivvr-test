const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const User = require('../models/User');
const emailService = require('../services/emailService');

// Generate JWT Token
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Generate 2FA backup codes
const generateBackupCodes = () => {
  const codes = [];
  for (let i = 0; i < 8; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
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

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password, twoFactorCode } = req.body;

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
      if (!twoFactorCode) {
        return res.status(200).json({
          success: true,
          requiresTwoFactor: true,
          message: 'Please provide your 2FA code'
        });
      }

      // Verify 2FA code
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 1
      });

      // If TOTP fails, check backup codes
      let usedBackupCode = false;
      if (!verified && user.backupCodes && user.backupCodes.length > 0) {
        const codeIndex = user.backupCodes.indexOf(twoFactorCode.toUpperCase());
        if (codeIndex !== -1) {
          // Remove used backup code
          user.backupCodes.splice(codeIndex, 1);
          await user.save();
          usedBackupCode = true;
        }
      }

      if (!verified && !usedBackupCode) {
        return res.status(401).json({
          success: false,
          message: 'Invalid 2FA code'
        });
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

// Setup 2FA - Generate QR code
exports.setup2FA = async (req, res) => {
  try {
    const userId = req.user.userId;
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
        message: '2FA is already enabled for this account'
      });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `${user.email} (Delivvr)`,
      issuer: 'Delivvr',
      length: 32
    });

    // Generate QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    // Store temporary secret (not yet enabled)
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
  try {
    const { token } = req.body;
    const userId = req.user.userId;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Please provide 2FA token'
      });
    }

    const user = await User.findById(userId);
    if (!user || !user.twoFactorTempSecret) {
      return res.status(400).json({
        success: false,
        message: 'No 2FA setup in progress'
      });
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorTempSecret,
      encoding: 'base32',
      token: token,
      window: 1
    });

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: 'Invalid 2FA token'
      });
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes();

    // Enable 2FA
    user.twoFactorEnabled = true;
    user.twoFactorSecret = user.twoFactorTempSecret;
    user.backupCodes = backupCodes;
    user.twoFactorTempSecret = undefined;
    await user.save();

    // Send email notification
    try {
      await emailService.send2FANotification(user.email, user.name, 'enabled');
    } catch (emailError) {
      console.error('Failed to send 2FA notification email:', emailError);
    }

    res.json({
      success: true,
      message: '2FA enabled successfully',
      data: {
        backupCodes: backupCodes
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
    const { password, twoFactorCode } = req.body;
    const userId = req.user.userId;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your password'
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
        message: '2FA is not enabled for this account'
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

    // Verify 2FA code if provided
    if (twoFactorCode) {
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 1
      });

      // Check backup codes if TOTP fails
      let usedBackupCode = false;
      if (!verified && user.backupCodes && user.backupCodes.length > 0) {
        usedBackupCode = user.backupCodes.includes(twoFactorCode.toUpperCase());
      }

      if (!verified && !usedBackupCode) {
        return res.status(400).json({
          success: false,
          message: 'Invalid 2FA code'
        });
      }
    }

    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.backupCodes = undefined;
    user.twoFactorTempSecret = undefined;
    await user.save();

    // Send email notification
    try {
      await emailService.send2FANotification(user.email, user.name, 'disabled');
    } catch (emailError) {
      console.error('Failed to send 2FA notification email:', emailError);
    }

    res.json({
      success: true,
      message: '2FA disabled successfully'
    });

  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during 2FA disable'
    });
  }
};

// Generate new backup codes
exports.generateBackupCodes = async (req, res) => {
  try {
    const { password, twoFactorCode } = req.body;
    const userId = req.user.userId;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your password'
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
        message: '2FA is not enabled for this account'
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
    if (!twoFactorCode) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your 2FA code'
      });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: twoFactorCode,
      window: 1
    });

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: 'Invalid 2FA code'
      });
    }

    // Generate new backup codes
    const backupCodes = generateBackupCodes();
    user.backupCodes = backupCodes;
    await user.save();

    res.json({
      success: true,
      message: 'New backup codes generated successfully',
      data: {
        backupCodes: backupCodes
      }
    });

  } catch (error) {
    console.error('Generate backup codes error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during backup codes generation'
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
      twoFactorEnabled: user.twoFactorEnabled || false,
      backupCodesCount: user.backupCodes ? user.backupCodes.length : 0
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