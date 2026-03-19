const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const User = require('../models/User');
const authController = require('../authController');
const { sendEmail } = require('../utils/emailService');
const { sendSMS } = require('../utils/smsService');

// Mock dependencies
jest.mock('../models/User');
jest.mock('../utils/emailService');
jest.mock('../utils/smsService');
jest.mock('speakeasy');
jest.mock('bcryptjs');

const app = express();
app.use(express.json());
app.post('/register', authController.register);
app.post('/login', authController.login);
app.post('/verify-2fa', authController.verifyTwoFactor);
app.post('/setup-2fa-totp', authController.setupTOTP);
app.post('/setup-2fa-sms', authController.setupSMS);
app.post('/disable-2fa', authController.disable2FA);
app.post('/regenerate-backup-codes', authController.regenerateBackupCodes);

describe('Two-Factor Authentication - AuthController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  // TC-001: User can navigate to security settings and find 2FA options
  describe('TC-001: 2FA Options Access', () => {
    it('should return user security settings with 2FA options', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        twoFactorAuth: {
          isEnabled: false,
          method: null,
          backupCodes: []
        }
      };

      User.findById.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/security-settings')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('twoFactorAuth');
      expect(response.body.twoFactorAuth).toHaveProperty('isEnabled', false);
      expect(response.body.twoFactorAuth).toHaveProperty('availableMethods');
      expect(response.body.twoFactorAuth.availableMethods).toEqual(['totp', 'sms']);
    });
  });

  // TC-002: User can enable 2FA using authenticator apps
  describe('TC-002: Enable 2FA with Authenticator App', () => {
    it('should setup TOTP 2FA successfully', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        twoFactorAuth: {
          isEnabled: false
        },
        save: jest.fn().mockResolvedValue(true)
      };

      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/TestApp:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=TestApp'
      };

      User.findById.mockResolvedValue(mockUser);
      speakeasy.generateSecret.mockReturnValue(mockSecret);

      const response = await request(app)
        .post('/setup-2fa-totp')
        .set('Authorization', 'Bearer valid-token')
        .send();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('qrCode');
      expect(response.body).toHaveProperty('secret');
      expect(speakeasy.generateSecret).toHaveBeenCalled();
    });
  });

  // TC-003: User can enable 2FA using SMS verification
  describe('TC-003: Enable 2FA with SMS', () => {
    it('should setup SMS 2FA successfully', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        phone: '+1234567890',
        twoFactorAuth: {
          isEnabled: false
        },
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      sendSMS.mockResolvedValue({ success: true, messageId: 'msg123' });

      const response = await request(app)
        .post('/setup-2fa-sms')
        .set('Authorization', 'Bearer valid-token')
        .send({ phoneNumber: '+1234567890' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('SMS sent');
      expect(sendSMS).toHaveBeenCalledWith('+1234567890', expect.stringContaining('verification code'));
    });

    it('should fail with invalid phone number', async () => {
      const response = await request(app)
        .post('/setup-2fa-sms')
        .set('Authorization', 'Bearer valid-token')
        .send({ phoneNumber: 'invalid-phone' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('valid phone number');
    });
  });

  // TC-005: User must verify 2FA setup with valid code
  describe('TC-005: Verify 2FA Setup', () => {
    it('should verify TOTP code and enable 2FA', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        twoFactorAuth: {
          isEnabled: false,
          tempSecret: 'JBSWY3DPEHPK3PXP',
          method: 'totp'
        },
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      speakeasy.totp.verify.mockReturnValue(true);
      sendEmail.mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/verify-2fa')
        .set('Authorization', 'Bearer valid-token')
        .send({ code: '123456' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('enabled successfully');
      expect(mockUser.twoFactorAuth.isEnabled).toBe(true);
      expect(sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('Two-Factor Authentication Enabled'),
        expect.any(String)
      );
    });

    it('should fail with invalid TOTP code', async () => {
      const mockUser = {
        _id: 'user123',
        twoFactorAuth: {
          isEnabled: false,
          tempSecret: 'JBSWY3DPEHPK3PXP',
          method: 'totp',
          failedAttempts: 0
        },
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      speakeasy.totp.verify.mockReturnValue(false);

      const response = await request(app)
        .post('/verify-2fa')
        .set('Authorization', 'Bearer valid-token')
        .send({ code: '000000' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid verification code');
      expect(mockUser.twoFactorAuth.failedAttempts).toBe(1);
    });
  });

  // TC-006: User can generate backup recovery codes
  describe('TC-006: Generate Backup Recovery Codes', () => {
    it('should generate backup recovery codes during setup', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        twoFactorAuth: {
          isEnabled: true,
          method: 'totp',
          secret: 'JBSWY3DPEHPK3PXP',
          backupCodes: []
        },
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      bcrypt.hash.mockResolvedValue('hashed-code');

      const response = await request(app)
        .post('/regenerate-backup-codes')
        .set('Authorization', 'Bearer valid-token')
        .send();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.backupCodes).toHaveLength(8);
      expect(response.body.backupCodes[0]).toMatch(/^[A-F0-9]{8}$/);
    });
  });

  // TC-007: User is prompted for 2FA code during login
  describe('TC-007: 2FA Required During Login', () => {
    it('should require 2FA code after valid credentials', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        password: 'hashed-password',
        twoFactorAuth: {
          isEnabled: true,
          method: 'totp'
        }
      };

      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.requires2FA).toBe(true);
      expect(response.body).toHaveProperty('tempToken');
      expect(response.body.twoFactorMethod).toBe('totp');
    });
  });

  // TC-008: User can disable 2FA after providing credentials
  describe('TC-008: Disable 2FA', () => {
    it('should disable 2FA with valid password and 2FA code', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        password: 'hashed-password',
        twoFactorAuth: {
          isEnabled: true,
          method: 'totp',
          secret: 'JBSWY3DPEHPK3PXP'
        },
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      speakeasy.totp.verify.mockReturnValue(true);
      sendEmail.mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/disable-2fa')
        .set('Authorization', 'Bearer valid-token')
        .send({
          currentPassword: 'password123',
          twoFactorCode: '123456'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockUser.twoFactorAuth.isEnabled).toBe(false);
      expect(sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('Two-Factor Authentication Disabled'),
        expect.any(String)
      );
    });

    it('should fail to disable 2FA with invalid password', async () => {
      const mockUser = {
        _id: 'user123',
        password: 'hashed-password',
        twoFactorAuth: {
          isEnabled: true,
          failedAttempts: 0
        },
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      const response = await request(app)
        .post('/disable-2fa')
        .set('Authorization', 'Bearer valid-token')
        .send({
          currentPassword: 'wrongpassword',
          twoFactorCode: '123456'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid password');
    });
  });

  // TC-010: System locks account after multiple failed 2FA attempts
  describe('TC-010: Account Lockout After Failed 2FA Attempts', () => {
    it('should lock account after 5 failed 2FA attempts', async () => {
      const mockUser = {
        _id: 'user123',
        twoFactorAuth: {
          isEnabled: true,
          method: 'totp',
          secret: 'JBSWY3DPEHPK3PXP',
          failedAttempts: 4,
          isLocked: false
        },
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      speakeasy.totp.verify.mockReturnValue(false);

      const response = await request(app)
        .post('/verify-2fa')
        .set('Authorization', 'Bearer valid-token')
        .send({ code: '000000' });

      expect(response.status).toBe(423);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('locked');
      expect(mockUser.twoFactorAuth.isLocked).toBe(true);
      expect(mockUser.twoFactorAuth.lockUntil).toBeInstanceOf(Date);
    });

    it('should prevent login attempts when account is locked', async () => {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
      const mockUser = {
        _id: 'user123',
        twoFactorAuth: {
          isEnabled: true,
          isLocked: true,
          lockUntil: lockUntil
        }
      };

      User.findById.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/verify-2fa')
        .set('Authorization', 'Bearer valid-token')
        .send({ code: '123456' });

      expect(response.status).toBe(423);
      expect(response.body.message).toContain('temporarily locked');
    });
  });

  // TC-011: User receives email notification when 2FA is enabled/disabled
  describe('TC-011: Email Notifications for 2FA Changes', () => {
    it('should send email notification when 2FA is enabled', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        firstName: 'John',
        twoFactorAuth: {
          isEnabled: false,
          tempSecret: 'JBSWY3DPEHPK3PXP',
          method: 'totp'
        },
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      speakeasy.totp.verify.mockReturnValue(true);
      sendEmail.mockResolvedValue({ success: true });

      await request(app)
        .post('/verify-2fa')
        .set('Authorization', 'Bearer valid-token')
        .send({ code: '123456' });

      expect(sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Two-Factor Authentication Enabled',
        expect.stringContaining('two-factor authentication (2FA) has been successfully enabled')
      );
    });

    it('should send email notification when 2FA is disabled', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        firstName: 'John',
        password: 'hashed-password',
        twoFactorAuth: {
          isEnabled: true,
          method: 'totp',
          secret: 'JBSWY3DPEHPK3PXP'
        },
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      speakeasy.totp.verify.mockReturnValue(true);
      sendEmail.mockResolvedValue({ success: true });

      await request(app)
        .post('/disable-2fa')
        .set('Authorization', 'Bearer valid-token')
        .send({
          currentPassword: 'password123',
          twoFactorCode: '123456'
        });

      expect(sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Two-Factor Authentication Disabled',
        expect.stringContaining('Two-factor authentication has been disabled')
      );
    });
  });
});