const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

/**
 * Crypto utilities for Two-Factor Authentication
 */
class CryptoUtils {
  /**
   * Generate a secure random secret for TOTP
   * @returns {string} Base32 encoded secret
   */
  static generateTOTPSecret() {
    return speakeasy.generateSecret({
      name: process.env.APP_NAME || 'DelivVR',
      length: 32
    });
  }

  /**
   * Generate QR code for TOTP setup
   * @param {string} secret - The TOTP secret
   * @param {string} userEmail - User's email address
   * @param {string} appName - Application name
   * @returns {Promise<string>} Base64 encoded QR code image
   */
  static async generateQRCode(secret, userEmail, appName = 'DelivVR') {
    const otpauthUrl = speakeasy.otpauthURL({
      secret: secret,
      label: userEmail,
      name: appName,
      issuer: appName
    });

    try {
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
      return qrCodeDataUrl;
    } catch (error) {
      throw new Error('Failed to generate QR code: ' + error.message);
    }
  }

  /**
   * Verify TOTP token
   * @param {string} token - 6-digit TOTP token
   * @param {string} secret - User's TOTP secret
   * @param {number} window - Time window for validation (default: 1)
   * @returns {boolean} True if token is valid
   */
  static verifyTOTPToken(token, secret, window = 1) {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: window
    });
  }

  /**
   * Generate backup recovery codes
   * @param {number} count - Number of codes to generate (default: 10)
   * @returns {string[]} Array of recovery codes
   */
  static generateRecoveryCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Hash recovery codes for secure storage
   * @param {string[]} codes - Array of recovery codes
   * @returns {string[]} Array of hashed codes
   */
  static hashRecoveryCodes(codes) {
    return codes.map(code => {
      return crypto.createHash('sha256').update(code).digest('hex');
    });
  }

  /**
   * Verify recovery code against hash
   * @param {string} code - Recovery code to verify
   * @param {string} hash - Stored hash to compare against
   * @returns {boolean} True if code matches hash
   */
  static verifyRecoveryCode(code, hash) {
    const codeHash = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(codeHash), Buffer.from(hash));
  }

  /**
   * Encrypt sensitive data (e.g., TOTP secret)
   * @param {string} text - Text to encrypt
   * @param {string} key - Encryption key
   * @returns {object} Encrypted data with iv
   */
  static encrypt(text, key = process.env.ENCRYPTION_KEY) {
    if (!key) {
      throw new Error('Encryption key is required');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', key);
    cipher.setAutoPadding(true);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      iv: iv.toString('hex'),
      encryptedData: encrypted
    };
  }

  /**
   * Decrypt sensitive data
   * @param {string} encryptedData - Encrypted data
   * @param {string} iv - Initialization vector
   * @param {string} key - Decryption key
   * @returns {string} Decrypted text
   */
  static decrypt(encryptedData, iv, key = process.env.ENCRYPTION_KEY) {
    if (!key) {
      throw new Error('Decryption key is required');
    }

    const decipher = crypto.createDecipher('aes-256-cbc', key);
    decipher.setAutoPadding(true);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Generate secure random token for SMS verification
   * @param {number} length - Token length (default: 6)
   * @returns {string} Numeric token
   */
  static generateSMSToken(length = 6) {
    const digits = '0123456789';
    let token = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, digits.length);
      token += digits[randomIndex];
    }
    
    return token;
  }

  /**
   * Generate rate limiting key for 2FA attempts
   * @param {string} userId - User ID
   * @param {string} type - Type of 2FA (totp, sms, recovery)
   * @returns {string} Rate limiting key
   */
  static generateRateLimitKey(userId, type = 'totp') {
    return `2fa_attempts:${type}:${userId}`;
  }

  /**
   * Create secure hash for storing phone numbers
   * @param {string} phoneNumber - Phone number to hash
   * @returns {string} Hashed phone number
   */
  static hashPhoneNumber(phoneNumber) {
    // Remove all non-digit characters and hash
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    return crypto.createHash('sha256').update(cleanPhone).digest('hex');
  }

  /**
   * Validate TOTP token format
   * @param {string} token - Token to validate
   * @returns {boolean} True if token format is valid
   */
  static isValidTOTPFormat(token) {
    return /^\d{6}$/.test(token);
  }

  /**
   * Validate SMS token format
   * @param {string} token - Token to validate
   * @returns {boolean} True if token format is valid
   */
  static isValidSMSFormat(token) {
    return /^\d{4,8}$/.test(token);
  }

  /**
   * Validate recovery code format
   * @param {string} code - Recovery code to validate
   * @returns {boolean} True if code format is valid
   */
  static isValidRecoveryCodeFormat(code) {
    return /^[A-F0-9]{8}$/i.test(code);
  }
}

module.exports = CryptoUtils;