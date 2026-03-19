const twilio = require('twilio');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

class SMSService {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    this.verificationCodes = new Map(); // In production, use Redis
    this.codeExpiration = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Generate a 6-digit verification code
   */
  generateVerificationCode() {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Send SMS verification code
   * @param {string} phoneNumber - Phone number in E.164 format
   * @param {string} userId - User ID for tracking
   * @returns {Promise<Object>} Result object with success status
   */
  async sendVerificationCode(phoneNumber, userId) {
    try {
      // Validate phone number format
      if (!this.isValidPhoneNumber(phoneNumber)) {
        throw new Error('Invalid phone number format');
      }

      // Check rate limiting per phone number
      if (this.isRateLimited(phoneNumber)) {
        throw new Error('Too many SMS requests. Please wait before requesting another code.');
      }

      const code = this.generateVerificationCode();
      const message = `Your verification code is: ${code}. This code will expire in 5 minutes. Do not share this code with anyone.`;

      // Send SMS via Twilio
      const messageResult = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phoneNumber
      });

      // Store verification code with expiration
      const codeData = {
        code,
        userId,
        phoneNumber,
        createdAt: Date.now(),
        attempts: 0,
        maxAttempts: 3
      };

      this.verificationCodes.set(`${phoneNumber}_${userId}`, codeData);

      // Set cleanup timer
      setTimeout(() => {
        this.verificationCodes.delete(`${phoneNumber}_${userId}`);
      }, this.codeExpiration);

      return {
        success: true,
        messageSid: messageResult.sid,
        expiresIn: this.codeExpiration / 1000 // seconds
      };

    } catch (error) {
      console.error('SMS sending error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send SMS verification code'
      };
    }
  }

  /**
   * Verify SMS code
   * @param {string} phoneNumber - Phone number
   * @param {string} userId - User ID
   * @param {string} inputCode - Code entered by user
   * @returns {Object} Verification result
   */
  verifyCode(phoneNumber, userId, inputCode) {
    const key = `${phoneNumber}_${userId}`;
    const codeData = this.verificationCodes.get(key);

    if (!codeData) {
      return {
        success: false,
        error: 'No verification code found or code has expired'
      };
    }

    // Check if code has expired
    if (Date.now() - codeData.createdAt > this.codeExpiration) {
      this.verificationCodes.delete(key);
      return {
        success: false,
        error: 'Verification code has expired'
      };
    }

    // Check attempt limit
    if (codeData.attempts >= codeData.maxAttempts) {
      this.verificationCodes.delete(key);
      return {
        success: false,
        error: 'Maximum verification attempts exceeded'
      };
    }

    // Increment attempts
    codeData.attempts++;

    // Verify code
    if (codeData.code !== inputCode.toString()) {
      return {
        success: false,
        error: 'Invalid verification code',
        attemptsRemaining: codeData.maxAttempts - codeData.attempts
      };
    }

    // Code is valid - clean up
    this.verificationCodes.delete(key);

    return {
      success: true,
      message: 'Phone number verified successfully'
    };
  }

  /**
   * Validate phone number format (E.164)
   * @param {string} phoneNumber 
   * @returns {boolean}
   */
  isValidPhoneNumber(phoneNumber) {
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * Simple rate limiting check (in production, use Redis with sliding window)
   * @param {string} phoneNumber 
   * @returns {boolean}
   */
  isRateLimited(phoneNumber) {
    const rateLimitKey = `rate_${phoneNumber}`;
    const rateLimitData = this.verificationCodes.get(rateLimitKey);
    const now = Date.now();
    const windowSize = 60 * 1000; // 1 minute
    const maxRequests = 3;

    if (!rateLimitData) {
      this.verificationCodes.set(rateLimitKey, {
        requests: 1,
        windowStart: now
      });
      return false;
    }

    // Reset window if expired
    if (now - rateLimitData.windowStart > windowSize) {
      this.verificationCodes.set(rateLimitKey, {
        requests: 1,
        windowStart: now
      });
      return false;
    }

    // Check if limit exceeded
    if (rateLimitData.requests >= maxRequests) {
      return true;
    }

    // Increment requests
    rateLimitData.requests++;
    return false;
  }

  /**
   * Clean up expired codes (should be called periodically)
   */
  cleanupExpiredCodes() {
    const now = Date.now();
    for (const [key, data] of this.verificationCodes.entries()) {
      if (data.createdAt && (now - data.createdAt > this.codeExpiration)) {
        this.verificationCodes.delete(key);
      }
    }
  }

  /**
   * Get service health status
   * @returns {Promise<Object>}
   */
  async getHealthStatus() {
    try {
      // Test Twilio connection
      await this.client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      
      return {
        status: 'healthy',
        service: 'SMS',
        timestamp: new Date().toISOString(),
        activeCodesCount: this.verificationCodes.size
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'SMS',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Singleton instance
const smsService = new SMSService();

// Cleanup expired codes every 5 minutes
setInterval(() => {
  smsService.cleanupExpiredCodes();
}, 5 * 60 * 1000);

module.exports = smsService;