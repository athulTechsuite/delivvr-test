const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { sendEmail } = require('../services/emailService');

const router = express.Router();

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for 2FA routes
const twoFALimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many 2FA attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation middleware
const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('role').optional().isIn(['customer', 'vendor', 'admin']).withMessage('Invalid role specified')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').exists().withMessage('Password is required')
];

const twoFAValidation = [
  body('token').isLength({ min: 6, max: 6 }).isNumeric().withMessage('2FA token must be 6 digits')
];

// Helper function to generate backup codes
const generateBackupCodes = () => {
  const codes = [];
  for (let i = 0; i < 8; i++) {
    codes.push(crypto.randomBytes(5).toString('hex').toUpperCase());
  }
  return codes;
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', authLimiter, registerValidation, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password, firstName, lastName, role = 'customer' } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const user = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      isActive: true,
      createdAt: new Date(),
      twoFactorAuth: {
        enabled: false,
        secret: null,
        backupCodes: []
      }
    });

    await user.save();

    // Generate JWT token
    const payload = {
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user and get token (first step for 2FA users)
// @access  Public
router.post('/login', authLimiter, loginValidation, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if 2FA is enabled
    if (user.twoFactorAuth.enabled) {
      // Generate temporary token for 2FA verification
      const tempPayload = {
        user: {
          id: user._id,
          email: user.email,
          requireTwoFA: true
        }
      };

      const tempToken = jwt.sign(tempPayload, process.env.JWT_SECRET, { expiresIn: '10m' });

      return res.json({
        success: true,
        message: 'Password verified. Please provide 2FA code.',
        requiresTwoFA: true,
        tempToken
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const payload = {
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @route   POST /api/auth/verify-2fa
// @desc    Verify 2FA code and complete login
// @access  Public (but requires temp token)
router.post('/verify-2fa', twoFALimiter, twoFAValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid 2FA token format',
        errors: errors.array()
      });
    }

    const { token: twoFAToken } = req.body;
    const tempToken = req.header('Authorization')?.replace('Bearer ', '');

    if (!tempToken) {
      return res.status(401).json({
        success: false,
        message: 'Temporary token required'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired temporary token'
      });
    }

    if (!decoded.user.requireTwoFA) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token context'
      });
    }

    const user = await User.findById(decoded.user.id);
    if (!user || !user.twoFactorAuth.enabled) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user or 2FA not enabled'
      });
    }

    // Check if it's a backup code
    const isBackupCode = user.twoFactorAuth.backupCodes.some(code => code.code === twoFAToken && !code.used);
    
    let isValid = false;
    
    if (isBackupCode) {
      // Mark backup code as used
      const backupCode = user.twoFactorAuth.backupCodes.find(code => code.code === twoFAToken);
      backupCode.used = true;
      backupCode.usedAt = new Date();
      await user.save();
      isValid = true;
    } else {
      // Verify TOTP token
      isValid = speakeasy.totp.verify({
        secret: user.twoFactorAuth.secret,
        encoding: 'base32',
        token: twoFAToken,
        window: 2 // Allow for slight time drift
      });
    }

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired 2FA code'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate final JWT token
    const payload = {
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    };

    const finalToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      message: 'Login successful',
      token: finalToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });

  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during 2FA verification'
    });
  }
});

// @route   POST /api/auth/setup-2fa
// @desc    Setup 2FA for user account
// @access  Private
router.post('/setup-2fa', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token, authorization denied'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.twoFactorAuth.enabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is already enabled'
      });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Delivvr (${user.email})`,
      issuer: 'Delivvr'
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Store secret temporarily (not yet enabled)
    user.twoFactorAuth.secret = secret.base32;
    await user.save();

    res.json({
      success: true,
      message: '2FA setup initiated. Please scan the QR code with your authenticator app.',
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32
    });

  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during 2FA setup'
    });
  }
});

// @route   POST /api/auth/enable-2fa
// @desc    Enable 2FA after verification
// @access  Private
router.post('/enable-2fa', twoFAValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid 2FA token format',
        errors: errors.array()
      });
    }

    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token, authorization denied'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.twoFactorAuth.enabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is already enabled'
      });
    }

    if (!user.twoFactorAuth.secret) {
      return res.status(400).json({
        success: false,
        message: 'Please setup 2FA first'
      });
    }

    const { token: verificationToken } = req.body;

    // Verify the token
    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorAuth.secret,
      encoding: 'base32',
      token: verificationToken,
      window: 2
    });

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid 2FA code. Please try again.'
      });
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes().map(code => ({
      code,
      used: false,
      createdAt: new Date()
    }));

    // Enable 2FA
    user.twoFactorAuth.enabled = true;
    user.twoFactorAuth.backupCodes = backupCodes;
    user.twoFactorAuth.enabledAt = new Date();
    await user.save();

    // Send email notification
    try {
      await sendEmail(
        user.email,
        'Two-Factor Authentication Enabled',
        `Hello ${user.firstName},\n\nTwo-factor authentication has been successfully enabled on your Delivvr account.\n\nIf you did not make this change, please contact support immediately.\n\nBest regards,\nDelivvr Team`
      );
    } catch (emailError) {
      console.error('Failed to send 2FA enabled email:', emailError);
    }

    res.json({
      success: true,
      message: '2FA enabled successfully',
      backupCodes: backupCodes.map(code => code.code)
    });

  } catch (error) {
    console.error('2FA enable error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during 2FA enable'
    });
  }
});

// @route   POST /api/auth/disable-2fa
// @desc    Disable 2FA for user account
// @access  Private
router.post('/disable-2fa', [
  body('password').exists().withMessage('Password is required'),
  body('token').optional().isLength({ min: 6, max: 6 }).isNumeric().withMessage('2FA token must be 6 digits')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const authToken = req.header('Authorization')?.replace('Bearer ', '');
    if (!authToken) {
      return res.status(401).json({
        success: false,
        message: 'No token, authorization denied'
      });
    }

    const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.twoFactorAuth.enabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is not enabled'
      });
    }

    const { password, token: twoFAToken } = req.body;

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Verify 2FA token if provided
    if (twoFAToken) {
      // Check if it's a backup code
      const isBackupCode = user.twoFactorAuth.backupCodes.some(code => code.code === twoFAToken && !code.used);
      
      let isValid = false;
      
      if (isBackupCode) {
        isValid = true;
      } else {
        // Verify TOTP token
        isValid = speakeasy.totp.verify({
          secret: user.twoFactorAuth.secret,
          encoding: 'base32',
          token: twoFAToken,
          window: 2
        });
      }

      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid 2FA code'
        });
      }
    }

    // Disable 2FA
    user.twoFactorAuth = {
      enabled: false,
      secret: null,
      backupCodes: [],
      disabledAt: new Date()
    };
    await user.save();

    // Send email notification
    try {
      await sendEmail(
        user.email,
        'Two-Factor Authentication Disabled',
        `Hello ${user.firstName},\n\nTwo-factor authentication has been disabled on your Delivvr account.\n\nIf you did not make this change, please contact support immediately and consider re-enabling 2FA.\n\nBest regards,\nDelivvr Team`
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
      message: 'Server error during 2FA disable'
    });
  }
});

// @route   GET /api/auth/2fa-status
// @desc    Get 2FA status for user
// @access  Private
router.get('/2fa-status', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token, authorization denied'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const unusedBackupCodes = user.twoFactorAuth.backupCodes.filter(code => !code.used).length;

    res.json({
      success: true,
      twoFAEnabled: user.twoFactorAuth.enabled,
      backupCodesRemaining: unusedBackupCodes
    });

  } catch (error) {
    console.error('2FA status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting 2FA status'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', (req, res) => {
  // Since we're using JWT, logout is primarily handled client-side
  // This endpoint can be used for logging purposes or token blacklisting if implemented
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// @route   GET /api/auth/me
// @desc    Get current user info
// @access  Private
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token, authorization denied'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        twoFAEnabled: user.twoFactorAuth.enabled
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({
      success: false,
      message: 'Token is not valid'
    });
  }
});

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', [
  body('currentPassword').exists().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token, authorization denied'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
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
      message: 'Server error during password change'
    });
  }
});

module.exports = router;