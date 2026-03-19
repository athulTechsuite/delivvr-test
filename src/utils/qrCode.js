import QRCode from 'qrcode';

/**
 * Generate QR code data URL for TOTP setup
 * @param {string} secret - Base32 encoded secret key
 * @param {string} email - User's email address
 * @param {string} issuer - Application name (default: 'YourApp')
 * @returns {Promise<string>} Data URL of the QR code image
 */
export const generateTOTPQRCode = async (secret, email, issuer = 'YourApp') => {
  try {
    // Construct TOTP URI according to Google Authenticator format
    // Format: otpauth://totp/Label?secret=Secret&issuer=Issuer
    const otpUri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
    
    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpUri, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    });
    
    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

/**
 * Generate QR code as SVG string for better scalability
 * @param {string} secret - Base32 encoded secret key
 * @param {string} email - User's email address
 * @param {string} issuer - Application name (default: 'YourApp')
 * @returns {Promise<string>} SVG string of the QR code
 */
export const generateTOTPQRCodeSVG = async (secret, email, issuer = 'YourApp') => {
  try {
    const otpUri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
    
    const qrCodeSVG = await QRCode.toString(otpUri, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    });
    
    return qrCodeSVG;
  } catch (error) {
    console.error('Error generating QR code SVG:', error);
    throw new Error('Failed to generate QR code SVG');
  }
};

/**
 * Validate QR code parameters
 * @param {string} secret - Base32 encoded secret key
 * @param {string} email - User's email address
 * @returns {boolean} True if parameters are valid
 */
export const validateQRCodeParams = (secret, email) => {
  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    return false;
  }
  
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return false;
  }
  
  // Basic Base32 validation (should only contain A-Z and 2-7)
  const base32Regex = /^[A-Z2-7]+=*$/;
  if (!base32Regex.test(secret.toUpperCase())) {
    return false;
  }
  
  return true;
};

/**
 * Generate TOTP URI without QR code generation
 * @param {string} secret - Base32 encoded secret key
 * @param {string} email - User's email address
 * @param {string} issuer - Application name (default: 'YourApp')
 * @returns {string} TOTP URI string
 */
export const generateTOTPUri = (secret, email, issuer = 'YourApp') => {
  if (!validateQRCodeParams(secret, email)) {
    throw new Error('Invalid parameters for TOTP URI generation');
  }
  
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
};