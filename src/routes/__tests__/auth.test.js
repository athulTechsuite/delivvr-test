const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../../models/User');
const authRouter = require('../auth');
const { sendEmail } = require('../../services/emailService');

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../services/emailService');
jest.mock('qrcode');
jest.mock('speakeasy');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Two-Factor Authentication Routes', () => {
  let mockUser;
  let mockToken;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUser = {
      _id: 'user123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      twoFactorAuth: {
        isEnabled: false,
        secret: null,
        backupCodes: []
      },
      save: jest.fn().mockResolvedValue(true)
    };
    
    mockToken = 'mock.jwt.token';
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // TC-001: User can enable 2FA from their account settings page
  describe('POST /api/auth/2fa/setup - TC-001: Enable 2FA from settings', () => {
    it('should setup 2FA and return QR code for authenticated user', async () => {
      const mockSecret = {
        ascii: 'JBSWY3DPEHPK3PXP',
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/Delivvr%20(test@example.com)?secret=JBSWY3DPEHPK3PXP&issuer=Delivvr'
      };
      const mockQRCode = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...';
      const mockBackupCodes = ['ABCD1234', 'EFGH5678', 'IJKL9012'];

      User.findById.mockResolvedValue(mockUser);
      speakeasy.generateSecret.mockReturnValue(mockSecret);
      QRCode.toDataURL.mockResolvedValue(mockQRCode);
      
      const response = await request(app)
        .post('/api/auth/2fa/setup')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.qrCode).toBe(mockQRCode);
      expect(response.body.backupCodes).toHaveLength(8);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/setup')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });
  });

  // TC-002: System supports TOTP authentication using authenticator apps
  describe('POST /api/auth/2fa/verify - TC-002: TOTP Authentication Support', () => {
    it('should verify TOTP token and enable 2FA', async () => {
      mockUser.twoFactorAuth.secret = 'JBSWY3DPEHPK3PXP';
      User.findById.mockResolvedValue(mockUser);
      speakeasy.totp.verify.mockReturnValue(true);
      sendEmail.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/2fa/verify')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ token: '123456' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Two-factor authentication enabled successfully');
      expect(mockUser.twoFactorAuth.isEnabled).toBe(true);
      expect(sendEmail).toHaveBeenCalledWith(
        mockUser.email,
        'Two-Factor Authentication Enabled',
        expect.any(String)
      );
    });

    it('should reject invalid TOTP token', async () => {
      mockUser.twoFactorAuth.secret = 'JBSWY3DPEHPK3PXP';
      User.findById.mockResolvedValue(mockUser);
      speakeasy.totp.verify.mockReturnValue(false);

      const response = await request(app)
        .post('/api/auth/2fa/verify')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ token: '000000' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid 2FA code');
    });

    it('should validate token format', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/verify')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ token: '12345' }) // Invalid length
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors[0].msg).toBe('2FA token must be 6 digits');
    });
  });

  // TC-003: User receives a QR code to scan with their authenticator app during setup
  describe('QR Code Generation - TC-003: QR Code for authenticator app', () => {
    it('should generate QR code with correct TOTP URL format', async () => {
      const mockSecret = {
        ascii: 'JBSWY3DPEHPK3PXP',
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/Delivvr%20(test@example.com)?secret=JBSWY3DPEHPK3PXP&issuer=Delivvr'
      };
      const mockQRCode = 'data:image/png;base64,mock-qr-code';

      User.findById.mockResolvedValue(mockUser);
      speakeasy.generateSecret.mockReturnValue(mockSecret);
      QRCode.toDataURL.mockResolvedValue(mockQRCode);

      const response = await request(app)
        .post('/api/auth/2fa/setup')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(QRCode.toDataURL).toHaveBeenCalledWith(
        mockSecret.otpauth_url,
        expect.objectContaining({
          width: expect.any(Number),
          margin: expect.any(Number)
        })
      );
      expect(response.body.qrCode).toBe(mockQRCode);
    });
  });

  // TC-004: User can enter backup codes in case their authenticator device is unavailable
  describe('POST /api/auth/login - TC-004: Backup codes for device unavailability', () => {
    it('should allow login with valid backup code when 2FA is enabled', async () => {
      const mockUserWith2FA = {
        ...mockUser,
        twoFactorAuth: {
          isEnabled: true,
          secret: 'JBSWY3DPEHPK3PXP',
          backupCodes: [
            { code: 'ABCD1234', isUsed: false },
            { code: 'EFGH5678', isUsed: false }
          ]
        },
        password: await bcrypt.hash('password123', 12)
      };

      User.findOne.mockResolvedValue(mockUserWith2FA);
      bcrypt.compare = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
          twoFactorCode: 'ABCD1234',
          isBackupCode: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(mockUserWith2FA.twoFactorAuth.backupCodes[0].isUsed).toBe(true);
    });

    it('should reject used backup code', async () => {
      const mockUserWith2FA = {
        ...mockUser,
        twoFactorAuth: {
          isEnabled: true,
          secret: 'JBSWY3DPEHPK3PXP',
          backupCodes: [
            { code: 'ABCD1234', isUsed: true }
          ]
        },
        password: await bcrypt.hash('password123', 12)
      };

      User.findOne.mockResolvedValue(mockUserWith2FA);
      bcrypt.compare = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
          twoFactorCode: 'ABCD1234',
          isBackupCode: true
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or used backup code');
    });
  });

  // TC-005: Login flow requires 2FA code entry after successful password verification
  describe('POST /api/auth/login - TC-005: 2FA required after password verification', () => {
    it('should require 2FA code when 2FA is enabled', async () => {
      const mockUserWith2FA = {
        ...mockUser,
        twoFactorAuth: {
          isEnabled: true,
          secret: 'JBSWY3DPEHPK3PXP',
          backupCodes: []
        },
        password: await bcrypt.hash('password123', 12)
      };

      User.findOne.mockResolvedValue(mockUserWith2FA);
      bcrypt.compare = jest.fn().mockResolvedValue(true);
      speakeasy.totp.verify.mockReturnValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
          twoFactorCode: '123456'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: mockUserWith2FA.twoFactorAuth.secret,
        encoding: 'base32',
        token: '123456',
        window: 1
      });
    });

    it('should return temp token when password is correct but no 2FA code provided', async () => {
      const mockUserWith2FA = {
        ...mockUser,
        twoFactorAuth: {
          isEnabled: true,
          secret: 'JBSWY3DPEHPK3PXP',
          backupCodes: []
        },
        password: await bcrypt.hash('password123', 12)
      };

      User.findOne.mockResolvedValue(mockUserWith2FA);
      bcrypt.compare = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.requires2FA).toBe(true);
      expect(response.body.tempToken).toBeDefined();
    });
  });

  // TC-006: User can disable 2FA from their account settings with proper verification
  describe('POST /api/auth/2fa/disable - TC-006: Disable 2FA with verification', () => {
    it('should disable 2FA with valid password', async () => {
      const mockUserWith2FA = {
        ...mockUser,
        twoFactorAuth: {
          isEnabled: true,
          secret: 'JBSWY3DPEHPK3PXP',
          backupCodes: []
        },
        password: await bcrypt.hash('password123', 12)
      };

      User.findById.mockResolvedValue(mockUserWith2FA);
      bcrypt.compare = jest.fn().mockResolvedValue(true);
      sendEmail.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/2fa/disable')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ password: 'password123' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Two-factor authentication disabled successfully');
      expect(mockUserWith2FA.twoFactorAuth.isEnabled).toBe(false);
      expect(mockUserWith2FA.twoFactorAuth.secret).toBeNull();
      expect(sendEmail).toHaveBeenCalledWith(
        mockUserWith2FA.email,
        'Two-Factor Authentication Disabled',
        expect.any(String)
      );
    });

    it('should reject invalid password when disabling 2FA', async () => {
      const mockUserWith2FA = {
        ...mockUser,
        twoFactorAuth: {
          isEnabled: true,
          secret: 'JBSWY3DPEHPK3PXP',
          backupCodes: []
        },
        password: await bcrypt.hash('password123', 12)
      };

      User.findById.mockResolvedValue(mockUserWith2FA);
      bcrypt.compare = jest.fn().mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/2fa/disable')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ password: 'wrongpassword' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid password');
    });
  });

  // TC-007: System displays clear error messages for invalid or expired 2FA codes
  describe('Error Messages - TC-007: Clear error messages for invalid/expired codes', () => {
    it('should return clear error for invalid 2FA code format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
          twoFactorCode: '12345' // Invalid format
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          msg: '2FA token must be 6 digits'
        })
      );
    });

    it('should return clear error for expired/invalid TOTP code', async () => {
      const mockUserWith2FA = {
        ...mockUser,
        twoFactorAuth: {
          isEnabled: true,
          secret: 'JBSWY3DPEHPK3PXP',
          backupCodes: []
        },
        password: await bcrypt.hash('password123', 12)
      };

      User.findOne.mockResolvedValue(mockUserWith2FA);
      bcrypt.compare = jest.fn().mockResolvedValue(true);
      speakeasy.totp.verify.mockReturnValue(false);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
          twoFactorCode: '000000'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired 2FA code');
    });
  });

  // TC-009: User receives email notification when 2FA is enabled/disabled
  describe('Email Notifications - TC-009: Email alerts for 2FA changes', () => {
    it('should send email notification when 2FA is enabled', async () => {
      mockUser.twoFactorAuth.secret = 'JBSWY3DPEHPK3PXP';
      User.findById.mockResolvedValue(mockUser);
      speakeasy.totp.verify.mockReturnValue(true);
      sendEmail.mockResolvedValue(true);

      await request(app)
        .post('/api/auth/2fa/verify')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ token: '123456' })
        .expect(200);

      expect(sendEmail).toHaveBeenCalledWith(
        mockUser.email,
        'Two-Factor Authentication Enabled',
        expect.stringContaining('Two-factor authentication has been successfully enabled')
      );
    });

    it('should send email notification when 2FA is disabled', async () => {
      const mockUserWith2FA = {
        ...mockUser,
        twoFactorAuth: {
          isEnabled: true,
          secret: 'JBSWY3DPEHPK3PXP',
          backupCodes: []
        },
        password: await bcrypt.hash('password123', 12)
      };

      User.findById.mockResolvedValue(mockUserWith2FA);
      bcrypt.compare = jest.fn().mockResolvedValue(true);
      sendEmail.mockResolvedValue(true);

      await request(app)
        .post('/api/auth/2fa/disable')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ password: 'password123' })
        .expect(200);

      expect(sendEmail).toHaveBeenCalledWith(
        mockUserWith2FA.email,
        'Two-Factor Authentication Disabled',
        expect.stringContaining('Two-factor authentication has been disabled')
      );
    });
  });

  // Rate limiting tests
  describe('Rate Limiting', () => {
    it('should enforce rate limiting on 2FA endpoints', async () => {
      User.findById.mockResolvedValue(mockUser);
      
      // Make multiple requests to trigger rate limit
      const requests = Array.from({ length: 6 }, () => 
        request(app)
          .post('/api/auth/2fa/verify')
          .set('Authorization', `Bearer ${mockToken}`)
          .send({ token: '123456' })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(res => res.status === 429);
      expect(rateLimited).toBe(true);
    });
  });
});