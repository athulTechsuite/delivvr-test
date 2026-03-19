const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateToken, require2FA } = require('../auth');

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../models/User');

describe('Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      user: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('authenticateToken Middleware', () => {
    // TC-007: Authentication token validation
    it('should authenticate valid token successfully', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        isActive: true,
        twoFactorAuth: {
          isLocked: false,
          lockUntil: null
        }
      };

      req.headers.authorization = 'Bearer valid-token';
      jwt.verify.mockReturnValue({ userId: 'user123' });
      User.findById.mockResolvedValue(mockUser);

      await authenticateToken(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
      expect(User.findById).toHaveBeenCalledWith('user123');
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject request without token', async () => {
      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access token required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid token', async () => {
      req.headers.authorization = 'Bearer invalid-token';
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject expired token', async () => {
      req.headers.authorization = 'Bearer expired-token';
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      jwt.verify.mockImplementation(() => {
        throw expiredError;
      });

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token expired'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject token for non-existent user', async () => {
      req.headers.authorization = 'Bearer valid-token';
      jwt.verify.mockReturnValue({ userId: 'nonexistent' });
      User.findById.mockResolvedValue(null);

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject token for inactive user', async () => {
      const inactiveUser = {
        _id: 'user123',
        email: 'test@example.com',
        isActive: false
      };

      req.headers.authorization = 'Bearer valid-token';
      jwt.verify.mockReturnValue({ userId: 'user123' });
      User.findById.mockResolvedValue(inactiveUser);

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Account is deactivated'
      });
      expect(next).not.toHaveBeenCalled();
    });

    // TC-010: Account lockout due to failed 2FA attempts
    it('should reject access when account is locked due to 2FA failures', async () => {
      const lockedUser = {
        _id: 'user123',
        email: 'test@example.com',
        isActive: true,
        twoFactorAuth: {
          isLocked: true,
          lockUntil: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
        }
      };

      req.headers.authorization = 'Bearer valid-token';
      jwt.verify.mockReturnValue({ userId: 'user123' });
      User.findById.mockResolvedValue(lockedUser);

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(423);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('Account temporarily locked due to multiple failed 2FA attempts')
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow access when lock period has expired', async () => {
      const previouslyLockedUser = {
        _id: 'user123',
        email: 'test@example.com',
        isActive: true,
        twoFactorAuth: {
          isLocked: true,
          lockUntil: new Date(Date.now() - 1000) // 1 second ago (expired)
        }
      };

      req.headers.authorization = 'Bearer valid-token';
      jwt.verify.mockReturnValue({ userId: 'user123' });
      User.findById.mockResolvedValue(previouslyLockedUser);

      await authenticateToken(req, res, next);

      expect(req.user).toEqual(previouslyLockedUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('require2FA Middleware', () => {
    beforeEach(() => {
      req.user = {
        _id: 'user123',
        email: 'test@example.com',
        twoFactorAuth: {
          isEnabled: false
        }
      };
    });

    // TC-007: 2FA verification requirement during protected operations
    it('should allow access when 2FA is not enabled', async () => {
      await require2FA(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should require 2FA verification when enabled', async () => {
      req.user.twoFactorAuth.isEnabled = true;
      req.user.twoFactorAuth.isVerified = false;

      await require2FA(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '2FA verification required',
        requires2FA: true
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow access when 2FA is enabled and verified', async () => {
      req.user.twoFactorAuth.isEnabled = true;
      req.user.twoFactorAuth.isVerified = true;

      await require2FA(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject when user is not authenticated', async () => {
      req.user = null;

      await require2FA(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle temporary 2FA tokens correctly', async () => {
      req.user.twoFactorAuth.isEnabled = true;
      req.headers.authorization = 'Bearer temp-2fa-token';
      
      // Mock JWT decode to show this is a temporary 2FA token
      jwt.decode = jest.fn().mockReturnValue({
        userId: 'user123',
        temp2FA: true
      });

      await require2FA(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '2FA verification required',
        requires2FA: true
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete authentication flow with 2FA', async () => {
      const user2FA = {
        _id: 'user123',
        email: 'test@example.com',
        isActive: true,
        twoFactorAuth: {
          isEnabled: true,
          isVerified: true,
          isLocked: false,
          lockUntil: null
        }
      };

      req.headers.authorization = 'Bearer valid-token';
      jwt.verify.mockReturnValue({ userId: 'user123' });
      User.findById.mockResolvedValue(user2FA);

      // First middleware - authenticate token
      await authenticateToken(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toEqual(user2FA);

      // Reset next mock for second middleware
      next.mockClear();

      // Second middleware - check 2FA
      await require2FA(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block access flow when 2FA verification is pending', async () => {
      const user2FA = {
        _id: 'user123',
        email: 'test@example.com',
        isActive: true,
        twoFactorAuth: {
          isEnabled: true,
          isVerified: false,
          isLocked: false,
          lockUntil: null
        }
      };

      req.headers.authorization = 'Bearer valid-token';
      jwt.verify.mockReturnValue({ userId: 'user123' });
      User.findById.mockResolvedValue(user2FA);

      // First middleware - authenticate token
      await authenticateToken(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toEqual(user2FA);

      // Reset mocks for second middleware
      next.mockClear();
      res.status.mockClear();
      res.json.mockClear();

      // Second middleware - check 2FA (should fail)
      await require2FA(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '2FA verification required',
        requires2FA: true
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});