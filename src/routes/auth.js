const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const router = express.Router();

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Enhanced rate limiting for 2FA attempts
const tfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 2FA attempts per windowMs
  message: 'Too many 2FA attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Email transporter setup
const emailTransporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Helper function to send SMS (placeholder - integrate with your SMS service)
const sendSMS = async (phoneNumber, message) => {
  // Integrate with SMS service like Twilio
  console.log(`SMS to ${phoneNumber}: ${message}`);
};

// Helper function to send email notifications
const sendEmailNotification = async (email, subject, message) => {
  try {
    await emailTransporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: email,
      subject,
      text: message,
      html: `<p>${message}</p>`
    });
  } catch (error) {
    console.error('Email notification error:', error);
  }
};

// Helper function to generate backup codes
const generateBackupCodes = () => {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
};

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
  body('password').exists().withMessage('Password is required'),
  body('tfaCode').optional().isLength({ min: 6, max: 8 }).withMessage('2FA code must be 6-8 characters')
];

const tfaSetupValidation = [
  body('method').isIn(['app', 'sms']).withMessage('Method must be either app or sms'),
  body('phoneNumber').optional().isMobilePhone().withMessage('Please provide a valid phone number')
];

const tfaVerifyValidation = [
  body('code').isLength({ min: 6, max: 8 }).withMessage('Code must be 6-8 characters')
];

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
        method: null,
        secret: null,
        backupCodes: [],
        phoneNumber: null,
        failedAttempts: 0,
        lockedUntil: null
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
// @desc    Authenticate user and get token
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

    const { email, password, tfaCode } = req.body;

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
      // Check if account is locked due to failed 2FA attempts
      if (user.twoFactorAuth.lockedUntil && user.twoFactorAuth.lockedUntil > new Date()) {
        return res.status(423).json({
          success: false,
          message: 'Account temporarily locked due to multiple failed 2FA attempts. Please try again later.',
          lockedUntil: user.twoFactorAuth.lockedUntil
        });
      }

      if (!tfaCode) {
        return res.status(200).json({
          success: false,
          message: '2FA code required',
          requiresTwoFactor: true,
          method: user.twoFactorAuth.method
        });
      }

      // Verify 2FA code
      let isValidTFA = false;

      if (user.twoFactorAuth.method === 'app') {
        // Verify TOTP code
        const verified = speakeasy.totp.verify({
          secret: user.twoFactorAuth.secret,
          encoding: 'base32',
          token: tfaCode,
          window: 1 // Allow 30-second window
        });
        isValidTFA = verified;
      } else if (user.twoFactorAuth.method === 'sms') {
        // In a real implementation, you would verify the SMS code sent earlier
        // For now, we'll check against backup codes or implement SMS verification
        isValidTFA = user.twoFactorAuth.backupCodes.includes(tfaCode.toUpperCase());
        if (isValidTFA) {
          // Remove used backup code
          user.twoFactorAuth.backupCodes = user.twoFactorAuth.backupCodes.filter(
            code => code !== tfaCode.toUpperCase()
          );
        }
      }

      // Check backup codes if primary method fails
      if (!isValidTFA) {
        isValidTFA = user.twoFactorAuth.backupCodes.includes(tfaCode.toUpperCase());
        if (isValidTFA) {
          // Remove used backup code
          user.twoFactorAuth.backupCodes = user.twoFactorAuth.backupCodes.filter(
            code => code !== tfaCode.toUpperCase()
          );
        }
      }

      if (!isValidTFA) {
        // Increment failed attempts
        user.twoFactorAuth.failedAttempts = (user.twoFactorAuth.failedAttempts || 0) + 1;
        
        // Lock account after 5 failed attempts
        if (user.twoFactorAuth.failedAttempts >= 5) {
          user.twoFactorAuth.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
          await user.save();
          
          return res.status(423).json({
            success: false,
            message: 'Account temporarily locked due to multiple failed 2FA attempts.'
          });
        }

        await user.save();
        return res.status(400).json({
          success: false,
          message: 'Invalid 2FA code'
        });
      }

      // Reset failed attempts on successful 2FA
      user.twoFactorAuth.failedAttempts = 0;
      user.twoFactorAuth.lockedUntil = null;
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
        role: user.role,
        twoFactorEnabled: user.twoFactorAuth.enabled
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

// @route   POST /api/auth/2fa/setup
// @desc    Setup 2FA for user account
// @access  Private
router.post('/2fa/setup', tfaLimiter, tfaSetupValidation, async (req, res) => {
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

    const { method, phoneNumber } = req.body;

    if (method === 'app') {
      // Generate secret for TOTP
      const secret = speakeasy.generateSecret({
        name: `Delivvr (${user.email})`,
        issuer: 'Delivvr'
      });

      // Generate QR code
      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

      // Store temporary secret (not yet enabled)
      user.twoFactorAuth.tempSecret = secret.base32;

      await user.save();

      res.json({
        success: true,
        message: '2FA setup initiated',
        qrCode: qrCodeUrl,
        secret: secret.base32,
        manualEntryKey: secret.base32
      });

    } else if (method === 'sms') {
      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required for SMS 2FA'
        });
      }

      // Generate and send SMS verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store temporary phone number and verification code
      user.twoFactorAuth.tempPhoneNumber = phoneNumber;
      user.twoFactorAuth.tempVerificationCode = verificationCode;
      user.twoFactorAuth.tempCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await user.save();

      // Send SMS with verification code
      await sendSMS(phoneNumber, `Your Delivvr verification code is: ${verificationCode}`);

      res.json({
        success: true,
        message: 'SMS verification code sent',
        phoneNumber: phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') // Mask phone number
      });
    }

  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during 2FA setup'
    });
  }
});

// @route   POST /api/auth/2fa/verify-setup
// @desc    Verify and activate 2FA setup
// @access  Private
router.post('/2fa/verify-setup', tfaLimiter, tfaVerifyValidation, async (req, res) => {
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

    const { code } = req.body;
    let isValid = false;

    if (user.twoFactorAuth.tempSecret) {
      // Verify TOTP code
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorAuth.tempSecret,
        encoding: 'base32',
        token: code,
        window: 1
      });
      isValid = verified;

      if (isValid) {
        // Activate TOTP 2FA
        user.twoFactorAuth.enabled = true;
        user.twoFactorAuth.method = 'app';
        user.twoFactorAuth.secret = user.twoFactorAuth.tempSecret;
        user.twoFactorAuth.tempSecret = undefined;
      }
    } else if (user.twoFactorAuth.tempPhoneNumber && user.twoFactorAuth.tempVerificationCode) {
      // Verify SMS code
      if (user.twoFactorAuth.tempCodeExpires < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Verification code has expired'
        });
      }

      isValid = code === user.twoFactorAuth.tempVerificationCode;

      if (isValid) {
        // Activate SMS 2FA
        user.twoFactorAuth.enabled = true;
        user.twoFactorAuth.method = 'sms';
        user.twoFactorAuth.phoneNumber = user.twoFactorAuth.tempPhoneNumber;
        user.twoFactorAuth.tempPhoneNumber = undefined;
        user.twoFactorAuth.tempVerificationCode = undefined;
        user.twoFactorAuth.tempCodeExpires = undefined;
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'No 2FA setup in progress'
      });
    }

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes();
    user.twoFactorAuth.backupCodes = backupCodes;
    user.twoFactorAuth.failedAttempts = 0;
    user.twoFactorAuth.lockedUntil = null;

    await user.save();

    // Send email notification
    await sendEmailNotification(
      user.email,
      'Two-Factor Authentication Enabled',
      `Two-factor authentication has been successfully enabled on your Delivvr account using ${user.twoFactorAuth.method === 'app' ? 'authenticator app' : 'SMS'}.`
    );

    res.json({
      success: true,
      message: '2FA has been successfully enabled',
      backupCodes: backupCodes,
      method: user.twoFactorAuth.method
    });

  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during 2FA verification'
    });
  }
});

// @route   POST /api/auth/2fa/disable
// @desc    Disable 2FA for user account
// @access  Private
router.post('/2fa/disable', [
  body('password').exists().withMessage('Password is required'),
  body('tfaCode').exists().withMessage('2FA code is required')
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

    if (!user.twoFactorAuth.enabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is not enabled'
      });
    }

    const { password, tfaCode } = req.body;

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Verify 2FA code
    let isValidTFA = false;

    if (user.twoFactorAuth.method === 'app') {
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorAuth.secret,
        encoding: 'base32',
        token: tfaCode,
        window: 1
      });
      isValidTFA = verified;
    }

    // Check backup codes if primary method fails or for SMS users
    if (!isValidTFA) {
      isValidTFA = user.twoFactorAuth.backupCodes.includes(tfaCode.toUpperCase());
    }

    if (!isValidTFA) {
      return res.status(400).json({
        success: false,
        message: 'Invalid 2FA code'
      });
    }

    // Disable 2FA
    user.twoFactorAuth = {
      enabled: false,
      method: null,
      secret: null,
      backupCodes: [],
      phoneNumber: null,
      failedAttempts: 0,
      lockedUntil: null
    };

    await user.save();

    // Send email notification
    await sendEmailNotification(
      user.email,
      'Two-Factor Authentication Disabled',
      'Two-factor authentication has been disabled on your Delivvr account.'
    );

    res.json({
      success: true,
      message: '2FA has been successfully disabled'
    });

  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while disabling 2FA'
    });
  }
});

// @route   POST /api/auth/2fa/regenerate-backup-codes
// @desc    Regenerate backup recovery codes
// @access  Private
router.post('/2fa/regenerate-backup-codes', [
  body('password').exists().withMessage('Password is required')
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

    if (!user.twoFactorAuth.enabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is not enabled'
      });
    }

    const { password } = req.body;

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Generate new backup codes
    const newBackupCodes = generateBackupCodes();
    user.twoFactorAuth.backupCodes = newBackupCodes;

    await user.save();

    res.json({
      success: true,
      message: 'Backup codes have been regenerated',
      backupCodes: newBackupCodes
    });

  } catch (error) {
    console.error('Backup codes regeneration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while regenerating backup codes'
    });
  }
});

// @route   GET /api/auth/2fa/status
// @desc    Get 2FA status for current user
// @access  Private
router.get('/2fa/status', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token, authorization denied'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id).select('-password -twoFactorAuth.secret -twoFactorAuth.backupCodes');

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
        method: user.twoFactorAuth.method,
        phoneNumber: user.twoFactorAuth.phoneNumber ? 
          user.twoFactorAuth.phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null,
        backupCodesCount: user.twoFactorAuth.backupCodes.length,
        isLocked: user.twoFactorAuth.lockedUntil && user.twoFactorAuth.lockedUntil > new Date()
      }
    });

  } catch (error) {
    console.error('2FA status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching 2FA status'
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
        twoFactorEnabled: user.twoFactorAuth.enabled
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