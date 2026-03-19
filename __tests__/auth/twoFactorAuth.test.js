const request = require('supertest');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const jwt = require('jsonwebtoken');
const User = require('../../src/models/User');
const app = require('../../src/app');

// Mock dependencies
jest.mock('../../src/models/User');
jest.mock('qrcode');
jest.mock('speakeasy');
jest.mock('../../src/services/emailService');

describe('Two-Factor Authentication', () => {
  let mockUser;
  let authToken;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUser = {
      _id: 'user123',
      email: 'test@example.com',
      password: 'hashedpassword',
      twoFactor: {
        isEnabled: false,
        secret: null,
        backupCodes: [],
        enabledAt: null,
        lastUsed: null,
        failedAttempts: 0,
        lockedUntil: null
      },
      save: jest.fn().mockResolvedValue(true),
      select: jest.fn().mockReturnThis(),
      toObject: jest.fn().mockReturnValue({})
    };
    
    authToken = jwt.sign({ userId: 'user123', role: 'customer' }, process.env.JWT_SECRET || 'testsecret');
  });

  describe('TC-001: Enable 2FA from account settings', () => {
    it('should allow user to enable 2FA with valid password', async () => {
      User.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      speakeasy.generateSecret.mockReturnValue({
        base32: 'TESTSECRET',
        otpauth_url: 'otpauth://totp/test'
      });

      const response = await request(app)
        .post('/api/auth/2fa/setup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: 'userpassword'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('qrCode');
      expect(response.body.data).toHaveProperty('secret');
      expect(response.body.data).toHaveProperty('backupCodes');
      expect(response.body.data.backupCodes).toHaveLength(10);
    });

    it('should reject 2FA setup with invalid password', async () => {
      User.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/2fa/setup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: 'wrongpassword'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid password');
    });

    it('should require authentication to access 2FA setup', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/setup')
        .send({
          password: 'userpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Access token required');
    });
  });

  describe('TC-002: TOTP support via authenticator apps', () => {
    it('should generate valid TOTP secret and QR code', async () => {
      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/Delivvr:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Delivvr'
      };

      User.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      speakeasy.generateSecret.mockReturnValue(mockSecret);

      const response = await request(app)
        .post('/api/auth/2fa/setup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: 'userpassword'
        });

      expect(speakeasy.generateSecret).toHaveBeenCalledWith({
        name: mockUser.email,
        issuer: 'Delivvr',
        length: 32
      });

      expect(response.status).toBe(200);
      expect(response.body.data.secret).toBe(mockSecret.base32);
    });

    it('should verify TOTP code correctly', async () => {
      mockUser.twoFactor.secret = 'TESTSECRET';
      User.findById.mockResolvedValue(mockUser);
      speakeasy.totp.verify.mockReturnValue(true);

      const response = await request(app)
        .post('/api/auth/2fa/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: '123456'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: 'TESTSECRET',
        encoding: 'base32',
        token: '123456',
        window: 2
      });
    });
  });

  describe('TC-003: QR code and manual secret entry', () => {
    it('should provide both QR code and manual secret for setup', async () => {
      User.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      speakeasy.generateSecret.mockReturnValue({
        base32: 'TESTSECRET',
        otpauth_url: 'otpauth://totp/test'
      });

      const qrcode = require('qrcode');
      qrcode.toDataURL = jest.fn().mockResolvedValue('data:image/png;base64,mock-qr-code');

      const response = await request(app)
        .post('/api/auth/2fa/setup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: 'userpassword'
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('qrCode');
      expect(response.body.data).toHaveProperty('manualEntryKey');
      expect(response.body.data.manualEntryKey).toBe('TESTSECRET');
      expect(qrcode.toDataURL).toHaveBeenCalled();
    });
  });

  describe('TC-004: Password requirement for enabling 2FA', () => {
    it('should require current password to enable 2FA', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/setup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          path: 'password',
          msg: expect.stringContaining('Password is required')
        })
      );
    });

    it('should validate password before generating 2FA secret', async () => {
      User.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/2fa/setup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: 'wrongpassword'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid password');
      expect(speakeasy.generateSecret).not.toHaveBeenCalled();
    });
  });

  describe('TC-005: Backup recovery codes generation', () => {
    it('should generate 10 backup codes when enabling 2FA', async () => {
      User.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      speakeasy.generateSecret.mockReturnValue({
        base32: 'TESTSECRET',
        otpauth_url: 'otpauth://totp/test'
      });

      const response = await request(app)
        .post('/api/auth/2fa/setup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: 'userpassword'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.backupCodes).toHaveLength(10);
      expect(response.body.data.backupCodes.every(code => 
        typeof code === 'string' && code.length === 8
      )).toBe(true);
    });

    it('should hash backup codes before storing in database', async () => {
      User.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValueOnce(true); // password verification
      bcrypt.hash.mockResolvedValue('hashedbackupcode');
      speakeasy.generateSecret.mockReturnValue({
        base32: 'TESTSECRET',
        otpauth_url: 'otpauth://totp/test'
      });

      await request(app)
        .post('/api/auth/2fa/setup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: 'userpassword'
        });

      expect(bcrypt.hash).toHaveBeenCalledTimes(10); // For each backup code
    });
  });

  describe('TC-006: Login flow with 2FA', () => {
    it('should prompt for 2FA code after successful password verification', async () => {
      const mockUserWith2FA = {
        ...mockUser,
        twoFactor: {
          ...mockUser.twoFactor,
          isEnabled: true,
          secret: 'TESTSECRET'
        }
      };

      User.findOne.mockResolvedValue(mockUserWith2FA);
      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'userpassword'
        });

      expect(response.status).toBe(200);
      expect(response.body.requiresTwoFactor).toBe(true);
      expect(response.body).toHaveProperty('tempToken');
      expect(response.body.token).toBeUndefined();
    });

    it('should complete login with valid 2FA code', async () => {
      const mockUserWith2FA = {
        ...mockUser,
        twoFactor: {
          ...mockUser.twoFactor,
          isEnabled: true,
          secret: 'TESTSECRET'
        }
      };

      User.findOne.mockResolvedValue(mockUserWith2FA);
      bcrypt.compare.mockResolvedValue(true);
      speakeasy.totp.verify.mockReturnValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'userpassword',
          twoFactorCode: '123456'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('token');
      expect(response.body.requiresTwoFactor).toBeFalsy();
    });
  });

  describe('TC-007: Disable 2FA', () => {
    it('should allow disabling 2FA with password and 2FA code', async () => {
      const mockUserWith2FA = {
        ...mockUser,
        twoFactor: {
          ...mockUser.twoFactor,
          isEnabled: true,
          secret: 'TESTSECRET'
        }
      };

      User.findById.mockResolvedValue(mockUserWith2FA);
      bcrypt.compare.mockResolvedValue(true);
      speakeasy.totp.verify.mockReturnValue(true);

      const response = await request(app)
        .post('/api/auth/2fa/disable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: 'userpassword',
          twoFactorCode: '123456'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockUserWith2FA.save).toHaveBeenCalled();
    });

    it('should allow disabling 2FA with password and backup code', async () => {
      const hashedBackupCode = await bcrypt.hash('ABCD1234', 10);
      const mockUserWith2FA = {
        ...mockUser,
        twoFactor: {
          ...mockUser.twoFactor,
          isEnabled: true,
          secret: 'TESTSECRET',
          backupCodes: [{
            code: hashedBackupCode,
            used: false
          }]
        }
      };

      User.findById.mockResolvedValue(mockUserWith2FA);
      bcrypt.compare.mockResolvedValueOnce(true); // password
      bcrypt.compare.mockResolvedValueOnce(true); // backup code

      const response = await request(app)
        .post('/api/auth/2fa/disable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: 'userpassword',
          backupCode: 'ABCD1234'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('TC-008: Rate limiting and failed attempts', () => {
    it('should rate limit 2FA attempts (max 5 per 15 minutes)', async () => {
      const mockUserWith2FA = {
        ...mockUser,
        twoFactor: {
          ...mockUser.twoFactor,
          isEnabled: true,
          secret: 'TESTSECRET',
          failedAttempts: 5,
          lockedUntil: new Date(Date.now() + 15 * 60 * 1000)
        }
      };

      User.findOne.mockResolvedValue(mockUserWith2FA);
      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'userpassword',
          twoFactorCode: '123456'
        });

      expect(response.status).toBe(429);
      expect(response.body.message).toContain('Too many failed attempts');
    });

    it('should increment failed attempts on invalid 2FA code', async () => {
      const mockUserWith2FA = {
        ...mockUser,
        twoFactor: {
          ...mockUser.twoFactor,
          isEnabled: true,
          secret: 'TESTSECRET',
          failedAttempts: 2
        }
      };

      User.findOne.mockResolvedValue(mockUserWith2FA);
      bcrypt.compare.mockResolvedValue(true);
      speakeasy.totp.verify.mockReturnValue(false);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'userpassword',
          twoFactorCode: '000000'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid 2FA code');
      expect(mockUserWith2FA.twoFactor.failedAttempts).toBe(3);
    });

    it('should lock account after 5 failed 2FA attempts', async () => {
      const mockUserWith2FA = {
        ...mockUser,
        twoFactor: {
          ...mockUser.twoFactor,
          isEnabled: true,
          secret: 'TESTSECRET',
          failedAttempts: 4
        },
        save: jest.fn()
      };

      User.findOne.mockResolvedValue(mockUserWith2FA);
      bcrypt.compare.mockResolvedValue(true);
      speakeasy.totp.verify.mockReturnValue(false);

      const emailService = require('../../src/services/emailService');
      emailService.sendSecurityAlert = jest.fn();

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'userpassword',
          twoFactorCode: '000000'
        });

      expect(response.status).toBe(429);
      expect(response.body.message).toContain('Account temporarily locked');
      expect(emailService.sendSecurityAlert).toHaveBeenCalledWith(
        mockUserWith2FA.email,
        'Account Locked Due to Failed 2FA Attempts'
      );
    });
  });

  describe('TC-009: Regenerate backup codes', () => {
    it('should regenerate backup codes with password and 2FA verification', async () => {
      const mockUserWith2FA = {
        ...mockUser,
        twoFactor: {
          ...mockUser.twoFactor,
          isEnabled: true,
          secret: 'TESTSECRET'
        }
      };

      User.findById.mockResolvedValue(mockUserWith2FA);
      bcrypt.compare.mockResolvedValue(true);
      speakeasy.totp.verify.mockReturnValue(true);

      const response = await request(app)
        .post('/api/auth/2fa/regenerate-backup-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: 'userpassword',
          twoFactorCode: '123456'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.backupCodes).toHaveLength(10);
      expect(mockUserWith2FA.save).toHaveBeenCalled();
    });

    it('should require both password and 2FA code to regenerate backup codes', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/regenerate-backup-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: 'userpassword'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('2FA code is required');
    });
  });
});