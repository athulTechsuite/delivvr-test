const nodemailer = require('nodemailer');
const config = require('../config/email');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.password
      }
    });
  }

  async sendEmail(to, subject, htmlContent, textContent = '') {
    try {
      const mailOptions = {
        from: config.from,
        to,
        subject,
        html: htmlContent,
        text: textContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${to}:`, result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error('Failed to send email');
    }
  }

  async send2FAEnabledNotification(userEmail, userName) {
    const subject = 'Two-Factor Authentication Enabled';
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Two-Factor Authentication Enabled</h2>
        <p>Hello ${userName},</p>
        <p>This email confirms that two-factor authentication (2FA) has been successfully enabled on your account.</p>
        <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; color: #27ae60;"><strong>✓ Your account is now more secure</strong></p>
        </div>
        <p>You will now be prompted to enter a verification code from your authenticator app or SMS when signing in.</p>
        <p>If you did not enable 2FA on your account, please contact our support team immediately.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #7f8c8d; font-size: 14px;">
          This is an automated security notification. Please do not reply to this email.
        </p>
      </div>
    `;
    
    const textContent = `
Two-Factor Authentication Enabled

Hello ${userName},

This email confirms that two-factor authentication (2FA) has been successfully enabled on your account.

Your account is now more secure. You will now be prompted to enter a verification code from your authenticator app or SMS when signing in.

If you did not enable 2FA on your account, please contact our support team immediately.

This is an automated security notification. Please do not reply to this email.
    `;

    return await this.sendEmail(userEmail, subject, htmlContent, textContent);
  }

  async send2FADisabledNotification(userEmail, userName) {
    const subject = 'Two-Factor Authentication Disabled';
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e74c3c;">Two-Factor Authentication Disabled</h2>
        <p>Hello ${userName},</p>
        <p>This email confirms that two-factor authentication (2FA) has been disabled on your account.</p>
        <div style="background-color: #fdf2e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; color: #e67e22;"><strong>⚠ Your account security has been reduced</strong></p>
        </div>
        <p>We recommend keeping 2FA enabled to protect your account from unauthorized access.</p>
        <p>If you did not disable 2FA on your account, please contact our support team immediately and consider changing your password.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #7f8c8d; font-size: 14px;">
          This is an automated security notification. Please do not reply to this email.
        </p>
      </div>
    `;

    const textContent = `
Two-Factor Authentication Disabled

Hello ${userName},

This email confirms that two-factor authentication (2FA) has been disabled on your account.

Your account security has been reduced. We recommend keeping 2FA enabled to protect your account from unauthorized access.

If you did not disable 2FA on your account, please contact our support team immediately and consider changing your password.

This is an automated security notification. Please do not reply to this email.
    `;

    return await this.sendEmail(userEmail, subject, htmlContent, textContent);
  }

  async sendSMS2FACode(phoneNumber, code) {
    // For SMS, we'll integrate with a service like Twilio
    // For now, this is a placeholder that could send an email as fallback
    const subject = 'Your Verification Code';
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Your Verification Code</h2>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
          <h1 style="font-size: 36px; letter-spacing: 8px; margin: 0; color: #2c3e50;">${code}</h1>
        </div>
        <p>Enter this code to complete your sign-in. This code will expire in 5 minutes.</p>
        <p style="color: #e74c3c; font-size: 14px;">If you didn't request this code, please ignore this message.</p>
      </div>
    `;

    const textContent = `
Your Verification Code: ${code}

Enter this code to complete your sign-in. This code will expire in 5 minutes.

If you didn't request this code, please ignore this message.
    `;

    // In production, this should be replaced with actual SMS sending
    return await this.sendEmail(phoneNumber, subject, htmlContent, textContent);
  }

  async sendAccountLockNotification(userEmail, userName, lockDuration) {
    const subject = 'Account Temporarily Locked - Security Alert';
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e74c3c;">Account Temporarily Locked</h2>
        <p>Hello ${userName},</p>
        <p>Your account has been temporarily locked due to multiple failed two-factor authentication attempts.</p>
        <div style="background-color: #fdf2e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; color: #e67e22;"><strong>🔒 Account will be unlocked in ${lockDuration} minutes</strong></p>
        </div>
        <p>This is a security measure to protect your account from unauthorized access attempts.</p>
        <p><strong>What you can do:</strong></p>
        <ul>
          <li>Wait ${lockDuration} minutes and try again</li>
          <li>Use a backup recovery code if you have them</li>
          <li>Contact support if you're having trouble with your authenticator</li>
        </ul>
        <p>If you weren't trying to access your account, please contact our support team immediately.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #7f8c8d; font-size: 14px;">
          This is an automated security notification. Please do not reply to this email.
        </p>
      </div>
    `;

    const textContent = `
Account Temporarily Locked

Hello ${userName},

Your account has been temporarily locked due to multiple failed two-factor authentication attempts.

Account will be unlocked in ${lockDuration} minutes.

This is a security measure to protect your account from unauthorized access attempts.

What you can do:
- Wait ${lockDuration} minutes and try again
- Use a backup recovery code if you have them
- Contact support if you're having trouble with your authenticator

If you weren't trying to access your account, please contact our support team immediately.

This is an automated security notification. Please do not reply to this email.
    `;

    return await this.sendEmail(userEmail, subject, htmlContent, textContent);
  }

  async send2FABackupCodesNotification(userEmail, userName) {
    const subject = 'New Backup Recovery Codes Generated';
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">New Backup Recovery Codes Generated</h2>
        <p>Hello ${userName},</p>
        <p>New backup recovery codes have been generated for your two-factor authentication.</p>
        <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; color: #27ae60;"><strong>✓ Your previous backup codes are no longer valid</strong></p>
        </div>
        <p><strong>Important reminders:</strong></p>
        <ul>
          <li>Store your new backup codes in a safe place</li>
          <li>Each backup code can only be used once</li>
          <li>These codes can be used if you lose access to your authenticator</li>
          <li>Previous backup codes have been invalidated</li>
        </ul>
        <p>If you did not request new backup codes, please contact our support team immediately.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #7f8c8d; font-size: 14px;">
          This is an automated security notification. Please do not reply to this email.
        </p>
      </div>
    `;

    const textContent = `
New Backup Recovery Codes Generated

Hello ${userName},

New backup recovery codes have been generated for your two-factor authentication.

Your previous backup codes are no longer valid.

Important reminders:
- Store your new backup codes in a safe place
- Each backup code can only be used once
- These codes can be used if you lose access to your authenticator
- Previous backup codes have been invalidated

If you did not request new backup codes, please contact our support team immediately.

This is an automated security notification. Please do not reply to this email.
    `;

    return await this.sendEmail(userEmail, subject, htmlContent, textContent);
  }
}

module.exports = new EmailService();