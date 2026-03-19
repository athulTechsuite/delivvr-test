const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const User = require('../models/User');

// Generate JWT token
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '24h' }
  );
};

// Generate backup codes
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
    const hashed = await bcrypt.hash(code, 10);
    hashedCodes.push(hashed);
  }
  return hashedCodes;
};

// Verify backup code
const verifyBackupCode = async (inputCode, hashedCodes) => {
  for (let i = 0; i < hashedCodes.length; i++) {
    if (await bcrypt.compare(inputCode, hashedCodes[i])) {
      return i; // Return index of used code
    }
  }
  return -1;
};

// Register new user
const register = async (req, res) => {
  try {
    const { username, email, password, role = 'customer' } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists'
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
      username,
      email,
      password: hashedPassword,
      role,
      profile: {
        firstName: '',
        lastName: '',
        phone: '',
        address: {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: ''
        }
      },
      twoFactorAuth: {
        enabled: false,
        secret: null,
        backupCodes: [],
        smsEnabled: false,
        phoneNumber: null,
        failedAttempts: 0,
        lockedUntil: null
      }
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id, user.role);

    // Return user data (excluding password and 2FA secret)
    const userData = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      profile: user.profile,
      isActive: user.isActive,
      createdAt: user.createdAt
    };

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: userData
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
const login = async (req, res) => {
  try {
    const { email, password, twoFactorCode } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
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

    // Check if account is locked due to failed 2FA attempts
    if (user.twoFactorAuth.lockedUntil && user.twoFactorAuth.lockedUntil > new Date()) {
      return res.status(423).json({
        success: false,
        message: 'Account temporarily locked due to multiple failed 2FA attempts. Please try again later.'
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
    if (user.twoFactorAuth.enabled) {
      if (!twoFactorCode) {
        return res.status(200).json({
          success: false,
          requires2FA: true,
          message: 'Two-factor authentication code required'
        });
      }

      // Verify 2FA code
      let isValid = false;

      // Check TOTP code
      if (user.twoFactorAuth.secret) {
        const verified = speakeasy.totp.verify({
          secret: user.twoFactorAuth.secret,
          encoding: 'base32',
          token: twoFactorCode,
          window: 1
        });
        if (verified) {
          isValid = true;
        }
      }

      // Check backup code if TOTP failed
      if (!isValid && user.twoFactorAuth.backupCodes.length > 0) {
        const backupCodeIndex = await verifyBackupCode(twoFactorCode, user.twoFactorAuth.backupCodes);
        if (backupCodeIndex >= 0) {
          // Remove used backup code
          user.twoFactorAuth.backupCodes.splice(backupCodeIndex, 1);
          isValid = true;
        }
      }

      if (!isValid) {
        // Increment failed attempts
        user.twoFactorAuth.failedAttempts = (user.twoFactorAuth.failedAttempts || 0) + 1;
        
        // Lock account after 5 failed attempts for 15 minutes
        if (user.twoFactorAuth.failedAttempts >= 5) {
          user.twoFactorAuth.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        }
        
        await user.save();

        return res.status(401).json({
          success: false,
          message: 'Invalid two-factor authentication code'
        });
      }

      // Reset failed attempts on successful login
      user.twoFactorAuth.failedAttempts = 0;
      user.twoFactorAuth.lockedUntil = null;
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id, user.role);

    // Return user data (excluding password and 2FA secret)
    const userData = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      profile: user.profile,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      twoFactorEnabled: user.twoFactorAuth.enabled
    };

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: userData
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
const setup2FA = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `DelivVR (${user.email})`,
      issuer: 'DelivVR'
    });

    // Generate QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    // Store temporary secret (not activated yet)
    user.twoFactorAuth.tempSecret = secret.base32;
    await user.save();

    res.json({
      success: true,
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntry: secret.otpauth_url
    });

  } catch (error) {
    console.error('Setup 2FA error:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting up two-factor authentication'
    });
  }
};

// Enable 2FA - Verify setup and activate
const enable2FA = async (req, res) => {
  try {
    const { verificationCode, method = 'totp', phoneNumber } = req.body;
    const userId = req.user.userId;

    if (!verificationCode) {
      return res.status(400).json({
        success: false,
        message: 'Verification code is required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (method === 'totp') {
      if (!user.twoFactorAuth.tempSecret) {
        return res.status(400).json({
          success: false,
          message: 'Please setup 2FA first'
        });
      }

      // Verify the code
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorAuth.tempSecret,
        encoding: 'base32',
        token: verificationCode,
        window: 1
      });

      if (!verified) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code'
        });
      }

      // Activate 2FA
      user.twoFactorAuth.enabled = true;
      user.twoFactorAuth.secret = user.twoFactorAuth.tempSecret;
      user.twoFactorAuth.tempSecret = null;
    } else if (method === 'sms') {
      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required for SMS 2FA'
        });
      }

      // In a real implementation, you would verify the SMS code here
      // For now, we'll assume the code is valid if it's 6 digits
      if (!/^\d{6}$/.test(verificationCode)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code'
        });
      }

      user.twoFactorAuth.enabled = true;
      user.twoFactorAuth.smsEnabled = true;
      user.twoFactorAuth.phoneNumber = phoneNumber;
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes();
    user.twoFactorAuth.backupCodes = await hashBackupCodes(backupCodes);
    user.updatedAt = new Date();

    await user.save();

    // TODO: Send email notification about 2FA being enabled

    res.json({
      success: true,
      message: 'Two-factor authentication enabled successfully',
      backupCodes
    });

  } catch (error) {
    console.error('Enable 2FA error:', error);
    res.status(500).json({
      success: false,
      message: 'Error enabling two-factor authentication'
    });
  }
};

// Disable 2FA
const disable2FA = async (req, res) => {
  try {
    const { password, twoFactorCode } = req.body;
    const userId = req.user.userId;

    if (!password || !twoFactorCode) {
      return res.status(400).json({
        success: false,
        message: 'Current password and 2FA code are required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Verify 2FA code
    let isValid = false;

    if (user.twoFactorAuth.secret) {
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorAuth.secret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 1
      });
      if (verified) {
        isValid = true;
      }
    }

    // Check backup code if TOTP failed
    if (!isValid && user.twoFactorAuth.backupCodes.length > 0) {
      const backupCodeIndex = await verifyBackupCode(twoFactorCode, user.twoFactorAuth.backupCodes);
      if (backupCodeIndex >= 0) {
        isValid = true;
      }
    }

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid two-factor authentication code'
      });
    }

    // Disable 2FA
    user.twoFactorAuth = {
      enabled: false,
      secret: null,
      backupCodes: [],
      smsEnabled: false,
      phoneNumber: null,
      failedAttempts: 0,
      lockedUntil: null,
      tempSecret: null
    };
    user.updatedAt = new Date();
    await user.save();

    // TODO: Send email notification about 2FA being disabled

    res.json({
      success: true,
      message: 'Two-factor authentication disabled successfully'
    });

  } catch (error) {
    console.error('Disable 2FA error:', error);
    res.status(500).json({
      success: false,
      message: 'Error disabling two-factor authentication'
    });
  }
};

// Regenerate backup codes
const regenerateBackupCodes = async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user.userId;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Current password is required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.twoFactorAuth.enabled) {
      return res.status(400).json({
        success: false,
        message: 'Two-factor authentication is not enabled'
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Generate new backup codes
    const backupCodes = generateBackupCodes();
    user.twoFactorAuth.backupCodes = await hashBackupCodes(backupCodes);
    user.updatedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Backup codes regenerated successfully',
      backupCodes
    });

  } catch (error) {
    console.error('Regenerate backup codes error:', error);
    res.status(500).json({
      success: false,
      message: 'Error regenerating backup codes'
    });
  }
};

// Get 2FA status
const get2FAStatus = async (req, res) => {
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
      twoFactorAuth: {
        enabled: user.twoFactorAuth.enabled,
        smsEnabled: user.twoFactorAuth.smsEnabled,
        phoneNumber: user.twoFactorAuth.phoneNumber,
        backupCodesRemaining: user.twoFactorAuth.backupCodes.length,
        isLocked: user.twoFactorAuth.lockedUntil && user.twoFactorAuth.lockedUntil > new Date()
      }
    });

  } catch (error) {
    console.error('Get 2FA status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching 2FA status'
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password -twoFactorAuth.secret -twoFactorAuth.backupCodes -twoFactorAuth.tempSecret');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile'
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { username, profile } = req.body;
    const userId = req.user.userId;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if username is being changed and is unique
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ 
        username, 
        _id: { $ne: userId } 
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists'
        });
      }
      user.username = username;
    }

    // Update profile fields
    if (profile) {
      user.profile = { ...user.profile, ...profile };
    }

    user.updatedAt = new Date();
    await user.save();

    // Return updated user data (excluding password and 2FA secrets)
    const userData = await User.findById(userId).select('-password -twoFactorAuth.secret -twoFactorAuth.backupCodes -twoFactorAuth.tempSecret');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: userData
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    user.password = hashedNewPassword;
    user.updatedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password'
    });
  }
};

// Admin: Get all users
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    let query = {};
    
    if (role) {
      query.role = role;
    }
    
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Get users with pagination
    const users = await User.find(query)
      .select('-password -twoFactorAuth.secret -twoFactorAuth.backupCodes -twoFactorAuth.tempSecret')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users'
    });
  }
};

// Admin: Update user role
const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const validRoles = ['customer', 'admin', 'vendor'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role, updatedAt: new Date() },
      { new: true }
    ).select('-password -twoFactorAuth.secret -twoFactorAuth.backupCodes -twoFactorAuth.tempSecret');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User role updated successfully',
      user
    });

  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user role'
    });
  }
};

// Admin: Toggle user active status
const toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isActive = !user.isActive;
    user.updatedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user status'
    });
  }
};

module.exports = {
  register,
  login,
  setup2FA,
  enable2FA,
  disable2FA,
  regenerateBackupCodes,
  get2FAStatus,
  getProfile,
  updateProfile,
  changePassword,
  getAllUsers,
  updateUserRole,
  toggleUserStatus
};