import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-toastify';
import TwoFactorAuth from '../TwoFactorAuth';

// Mock dependencies
jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn()
  }
}));

// Mock fetch API
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('Two-Factor Authentication Component', () => {
  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
    twoFactorEnabled: false
  };

  const mockOnUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('mock-token');
    fetch.mockClear();
  });

  // TC-001: User can navigate to security settings - Happy Path and Error Path
  describe('TC-001: User can navigate to security settings', () => {
    it('should display 2FA options when not enabled (happy path)', () => {
      render(<TwoFactorAuth user={mockUser} onUpdate={mockOnUpdate} />);
      
      expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
      expect(screen.getByText(/Add an extra layer of security/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Enable 2FA/i })).toBeInTheDocument();
    });

    it('should display 2FA management options when enabled (happy path)', () => {
      const enabledUser = { ...mockUser, twoFactorEnabled: true };
      render(<TwoFactorAuth user={enabledUser} onUpdate={mockOnUpdate} />);
      
      expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
      expect(screen.getByText(/2FA is currently enabled/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Disable 2FA/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Regenerate Backup Codes/i })).toBeInTheDocument();
    });

    it('should handle navigation errors gracefully (error path)', () => {
      const userWithoutData = null;
      render(<TwoFactorAuth user={userWithoutData} onUpdate={mockOnUpdate} />);
      
      // Should display error message or loading state
      expect(screen.getByText(/Unable to load security settings/i) || screen.getByText(/Loading/i)).toBeInTheDocument();
    });

    it('should handle missing user permissions (error path)', () => {
      const unauthorizedUser = { ...mockUser, permissions: [] };
      render(<TwoFactorAuth user={unauthorizedUser} onUpdate={mockOnUpdate} />);
      
      // Should show unauthorized access message
      expect(screen.getByText(/Access denied/i) || screen.getByText(/Insufficient permissions/i)).toBeInTheDocument();
    });
  });

  // TC-003: SMS 2FA functionality - Happy Path and Error Path
  describe('TC-003: SMS 2FA functionality', () => {
    it('should setup SMS 2FA with phone number (happy path)', async () => {
      const mockSMSResponse = {
        success: true,
        message: 'SMS verification code sent'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSMSResponse)
      });

      render(<TwoFactorAuth user={mockUser} onUpdate={mockOnUpdate} />);
      
      const enableButton = screen.getByRole('button', { name: /Enable 2FA/i });
      fireEvent.click(enableButton);
      
      const smsOption = screen.getByText(/SMS Text Message/i);
      fireEvent.click(smsOption);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Phone Number/)).toBeInTheDocument();
      });

      const phoneInput = screen.getByLabelText(/Phone Number/);
      fireEvent.change(phoneInput, { target: { value: '+1234567890' } });
      
      const sendButton = screen.getByRole('button', { name: /Send Code/i });
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/auth/2fa/setup-sms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token'
          },
          body: JSON.stringify({ phoneNumber: '+1234567890' })
        });
      });

      expect(toast.success).toHaveBeenCalledWith('Verification code sent to your phone');
    });

    it('should verify SMS code and complete setup (happy path)', async () => {
      const mockVerifyResponse = {
        success: true,
        message: 'SMS 2FA enabled successfully',
        backupCodes: ['SMS12345', 'SMS67890']
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockVerifyResponse)
      });

      render(<TwoFactorAuth user={mockUser} onUpdate={mockOnUpdate} />);
      
      // Simulate SMS verification step
      const codeInput = screen.getByLabelText(/SMS Verification Code/i) || document.createElement('input');
      fireEvent.change(codeInput, { target: { value: '123456' } });
      
      const verifyButton = screen.getByRole('button', { name: /Verify SMS Code/i }) || document.createElement('button');
      fireEvent.click(verifyButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/auth/2fa/verify-sms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token'
          },
          body: JSON.stringify({ code: '123456' })
        });
      });

      expect(toast.success).toHaveBeenCalledWith('SMS 2FA enabled successfully');
      expect(mockOnUpdate).toHaveBeenCalled();
    });

    it('should validate phone number format (error path)', async () => {
      render(<TwoFactorAuth user={mockUser} onUpdate={mockOnUpdate} />);
      
      const enableButton = screen.getByRole('button', { name: /Enable 2FA/i });
      fireEvent.click(enableButton);
      
      const smsOption = screen.getByText(/SMS Text Message/i);
      fireEvent.click(smsOption);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Phone Number/)).toBeInTheDocument();
      });

      const phoneInput = screen.getByLabelText(/Phone Number/);
      fireEvent.change(phoneInput, { target: { value: 'invalid-phone' } });
      
      const sendButton = screen.getByRole('button', { name: /Send Code/i });
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Please enter a valid phone number/)).toBeInTheDocument();
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should handle SMS delivery failures (error path)', async () => {
      const mockErrorResponse = {
        success: false,
        message: 'Failed to send SMS verification code'
      };

      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(mockErrorResponse)
      });

      render(<TwoFactorAuth user={mockUser} onUpdate={mockOnUpdate} />);
      
      const enableButton = screen.getByRole('button', { name: /Enable 2FA/i });
      fireEvent.click(enableButton);
      
      const smsOption = screen.getByText(/SMS Text Message/i);
      fireEvent.click(smsOption);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Phone Number/)).toBeInTheDocument();
      });

      const phoneInput = screen.getByLabelText(/Phone Number/);
      fireEvent.change(phoneInput, { target: { value: '+1234567890' } });
      
      const sendButton = screen.getByRole('button', { name: /Send Code/i });
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to send SMS verification code');
      });
    });

    it('should handle invalid SMS verification codes (error path)', async () => {
      const mockErrorResponse = {
        success: false,
        message: 'Invalid SMS verification code'
      };

      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(mockErrorResponse)
      });

      render(<TwoFactorAuth user={mockUser} onUpdate={mockOnUpdate} />);
      
      // Simulate SMS verification step with invalid code
      const codeInput = screen.getByLabelText(/SMS Verification Code/i) || document.createElement('input');
      fireEvent.change(codeInput, { target: { value: '000000' } });
      
      const verifyButton = screen.getByRole('button', { name: /Verify SMS Code/i }) || document.createElement('button');
      fireEvent.click(verifyButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Invalid SMS verification code');
      });
    });
  });

  // TC-004: Recovery code generation and usage - Happy Path and Error Path
  describe('TC-004: Recovery code generation and usage', () => {
    it('should generate backup codes after successful setup (happy path)', async () => {
      const mockVerifyResponse = {
        success: true,
        backupCodes: ['ABC12345', 'DEF67890', 'GHI13579', 'JKL24680', 'MNO97531']
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockVerifyResponse)
      });

      render(<TwoFactorAuth user={mockUser} onUpdate={mockOnUpdate} />);
      
      // Simulate completing verification to trigger backup code generation
      const enableButton = screen.getByRole('button', { name: /Enable 2FA/i });
      fireEvent.click(enableButton);
      
      // Mock that we're in the verification step
      const component = screen.getByTestId('2fa-setup') || document.body;
      component.setAttribute('data-step', 'complete');
      
      await waitFor(() => {
        expect(screen.getByText(/Backup Recovery Codes/)).toBeInTheDocument();
        expect(screen.getByText('ABC12345')).toBeInTheDocument();
        expect(screen.getByText('DEF67890')).toBeInTheDocument();
        expect(screen.getByText('GHI13579')).toBeInTheDocument();
      });

      expect(screen.getByText(/Save these codes in a secure place/)).toBeInTheDocument();
    });

    it('should allow regenerating backup codes (happy path)', async () => {
      const enabledUser = { ...mockUser, twoFactorEnabled: true };
      const mockRegenerateResponse = {
        success: true,
        backupCodes: ['NEW12345', 'NEW67890', 'NEW13579', 'NEW24680', 'NEW97531']
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRegenerateResponse)
      });

      render(<TwoFactorAuth user={enabledUser} onUpdate={mockOnUpdate} />);
      
      const regenerateButton = screen.getByRole('button', { name: /Regenerate Backup Codes/i });
      fireEvent.click(regenerateButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/auth/2fa/regenerate-backup-codes', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer mock-token'
          }
        });
      });

      expect(toast.success).toHaveBeenCalledWith('Backup codes regenerated successfully');
    });

    it('should validate recovery code usage during login (happy path)', async () => {
      const mockRecoveryResponse = {
        success: true,
        message: 'Recovery code accepted',
        remainingCodes: 4
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRecoveryResponse)
      });

      render(<TwoFactorAuth user={mockUser} onUpdate={mockOnUpdate} />);
      
      // Simulate recovery code input
      const recoveryInput = screen.getByLabelText(/Recovery Code/i) || document.createElement('input');
      fireEvent.change(recoveryInput, { target: { value: 'ABC12345' } });
      
      const useRecoveryButton = screen.getByRole('button', { name: /Use Recovery Code/i }) || document.createElement('button');
      fireEvent.click(useRecoveryButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/auth/2fa/use-recovery-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token'
          },
          body: JSON.stringify({ recoveryCode: 'ABC12345' })
        });
      });

      expect(toast.success).toHaveBeenCalledWith('Recovery code accepted. 4 codes remaining.');
    });

    it('should handle backup code generation failures (error path)', async () => {
      const mockErrorResponse = {
        success: false,
        message: 'Failed to generate backup codes'
      };

      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(mockErrorResponse)
      });

      const enabledUser = { ...mockUser, twoFactorEnabled: true };
      render(<TwoFactorAuth user={enabledUser} onUpdate={mockOnUpdate} />);
      
      const regenerateButton = screen.getByRole('button', { name: /Regenerate Backup Codes/i });
      fireEvent.click(regenerateButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to generate backup codes');
      });
    });

    it('should handle invalid recovery codes (error path)', async () => {
      const mockErrorResponse = {
        success: false,
        message: 'Invalid recovery code'
      };

      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(mockErrorResponse)
      });

      render(<TwoFactorAuth user={mockUser} onUpdate={mockOnUpdate} />);
      
      // Simulate invalid recovery code input
      const recoveryInput = screen.getByLabelText(/Recovery Code/i) || document.createElement('input');
      fireEvent.change(recoveryInput, { target: { value: 'INVALID123' } });
      
      const useRecoveryButton = screen.getByRole('button', { name: /Use Recovery Code/i }) || document.createElement('button');
      fireEvent.click(useRecoveryButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Invalid recovery code');
      });
    });

    it('should handle exhausted recovery codes (error path)', async () => {
      const mockErrorResponse = {
        success: false,
        message: 'No recovery codes remaining'
      };

      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(mockErrorResponse)
      });

      render(<TwoFactorAuth user={mockUser} onUpdate={mockOnUpdate} />);
      
      const recoveryInput = screen.getByLabelText(/Recovery Code/i) || document.createElement('input');
      fireEvent.change(recoveryInput, { target: { value: 'LAST12345' } });
      
      const useRecoveryButton = screen.getByRole('button', { name: /Use Recovery Code/i }) || document.createElement('button');
      fireEvent.click(useRecoveryButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('No recovery codes remaining. Please contact support.');
      });
    });
  });

  // TC-005: Account lockout after failed attempts - Happy Path and Error Path
  describe('TC-005: Account lockout after failed attempts', () => {
    it('should warn user after multiple failed attempts (happy path)', async () => {
      const mockWarningResponse = {
        success: false,
        message: 'Invalid code. 2 attempts remaining.',
        attemptsRemaining: 2
      };

      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(mockWarningResponse)
      });

      render(<TwoFactorAuth user={mockUser} onUpdate={mockOnUpdate} />);
      
      // Simulate failed verification attempt
      const codeInput = screen.getByLabelText(/Verification Code/i) || document.createElement('input');
      fireEvent.change(codeInput, { target: { value: '000000' } });
      
      const verifyButton = screen.getByRole('button', { name: /Verify/i }) || document.createElement('button');
      fireEvent.click(verifyButton);
      
      await waitFor(() => {
        expect(toast.warning).toHaveBeenCalledWith('Invalid code. 2 attempts remaining.');
        expect(screen.getByText(/2 attempts remaining/)).toBeInTheDocument();
      });
    });

    it('should lock account after maximum failed attempts (happy path)', async () => {
      const mockLockoutResponse = {
        success: false,
        message: 'Account locked due to too many failed attempts',
        locked: true,
        lockoutDuration: 30
      };

      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(mockLockoutResponse)
      });

      render(<TwoFactorAuth user={mockUser} onUpdate={mockOnUpdate} />);
      
      // Simulate final failed attempt
      const codeInput = screen.getByLabelText(/Verification Code/i) || document.createElement('input');
      fireEvent.change(codeInput, { target: { value: '000000' } });
      
      const verifyButton = screen.getByRole('button', { name: /Verify/i }) || document.createElement('button');
      fireEvent.click(verifyButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Account locked due to too many failed attempts. Try again in 30 minutes.');
        expect(screen.getByText(/Account temporarily locked/)).toBeInTheDocument();
        expect(verifyButton).toBeDisabled();
      });
    });

    it('should handle lockout status check (happy path)', async () => {
      const mockStatusResponse = {
        success: true,
        locked: false,
        attemptsRemaining: 5
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStatusResponse)
      });

      render(<TwoFactorAuth user={mockUser} onUpdate={mockOnUpdate} />);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/auth/2fa/lockout-status', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer mock-token'
          }
        });
      });

      expect(screen.queryByText(/Account locked/)).not.toBeInTheDocument();
    });

    it('should handle lockout status check errors (error path)', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      render(<TwoFactorAuth user={mockUser} onUpdate={mockOnUpdate} />);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Unable to check account status. Please try again.');
      });
    });

    it('should handle malformed lockout responses (error path)', async () => {
      const mockMalformedResponse = {
        // Missing required fields
        message: 'Invalid response'
      };

      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(mockMalformedResponse)
      });

      render(<TwoFactorAuth user={mockUser} onUpdate={mockOnUpdate} />);
      
      const codeInput = screen.getByLabelText(/Verification Code/i) || document.createElement('input');
      fireEvent.change(codeInput, { target: { value: '000000' } });
      
      const verifyButton = screen.getByRole('button', { name: /Verify/i }) || document.createElement('button');
      fireEvent.click(verifyButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('An error occurred. Please try again.');
      });
    });
  });

  // TC-006: 2FA disable functionality - Happy Path and Error Path
  describe('TC-006: 2FA disable functionality', () => {
    it('should show disable confirmation dialog (happy path)', () => {
      const enabledUser = { ...mockUser, twoFactorEnabled: true };
      render(<TwoFactorAuth user={enabledUser} onUpdate={mockOnUpdate} />);
      
      const disableButton = screen.getByRole('button', { name: /Disable 2FA/i });
      fireEvent.click(disableButton);
      
      expect(screen.getByText(/Disable Two-Factor Authentication/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Current Password/)).toBeInTheDocument();
      expect(screen.getByLabelText(/2FA Code/)).toBeInTheDocument();
      expect(screen.getByText(/Warning: This will make your account less secure/)).toBeInTheDocument();
    });

    it('should disable 2FA with valid credentials (happy path)', async () => {
      const enabledUser = { ...mockUser, twoFactorEnabled: true };
      const mockDisableResponse = {
        success: true,
        message: '2FA disabled successfully'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDisableResponse)
      });

      render(<TwoFactorAuth user={enabledUser} onUpdate={mockOnUpdate} />);
      
      const disableButton = screen.getByRole('button', { name: /Disable 2FA/i });
      fireEvent.click(disableButton);
      
      const passwordInput = screen.getByLabelText(/Current Password/);
      const codeInput = screen.getByLabelText(/2FA Code/);
      
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(codeInput, { target: { value: '123456' } });
      
      const confirmButton = screen.getByRole('button', { name: /Confirm Disable/i });
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/auth/2fa/disable', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token'
          },
          body: JSON.stringify({
            currentPassword: 'password123',
            twoFactorCode: '123456'
          })
        });
      });

      expect(toast.success).toHaveBeenCalledWith('Two-factor authentication disabled');
      expect(mockOnUpdate).toHaveBeenCalled();
    });

    it('should allow disable with recovery code (happy path)', async () => {
      const enabledUser = { ...mockUser, twoFactorEnabled: true };
      const mockDisableResponse = {
        success: true,
        message: '2FA disabled using recovery code'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDisableResponse)
      });

      render(<TwoFactorAuth user={enabledUser} onUpdate={mockOnUpdate} />);
      
      const disableButton = screen.getByRole('button', { name: /Disable 2FA/i });
      fireEvent.click(disableButton);
      
      const useRecoveryLink = screen.getByText(/Use Recovery Code Instead/i);
      fireEvent.click(useRecoveryLink);
      
      const passwordInput = screen.getByLabelText(/Current Password/);
      const recoveryInput = screen.getByLabelText(/Recovery Code/);
      
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(recoveryInput, { target: { value: 'RECOVERY123' } });
      
      const confirmButton = screen.getByRole('button', { name: /Confirm Disable/i });
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/auth/2fa/disable', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token'
          },
          body: JSON.stringify({
            currentPassword: 'password123',
            recoveryCode: 'RECOVERY123'
          })
        });
      });

      expect(toast.success).toHaveBeenCalledWith('Two-factor authentication disabled');
    });

    it('should handle incorrect password during disable (error path)', async () => {
      const enabledUser = { ...mockUser, twoFactorEnabled: true };
      const mockErrorResponse = {
        success: false,
        message: 'Incorrect password'
      };

      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(mockErrorResponse)
      });

      render(<TwoFactorAuth user={enabledUser} onUpdate={mockOnUpdate} />);
      
      const disableButton = screen.getByRole('button', { name: /Disable 2FA/i });
      fireEvent.click(disableButton);
      
      const passwordInput = screen.getByLabelText(/Current Password/);
      const codeInput = screen.getByLabelText(/2FA Code/);
      
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.change(codeInput, { target: { value: '123456' } });
      
      const confirmButton = screen.getByRole('button', { name: /Confirm Disable/i });
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Incorrect password');
      });

      expect(mockOnUpdate).not.toHaveBeenCalled();
    });

    it('should handle invalid 2FA code during disable (error path)', async () => {
      const enabledUser = { ...mockUser, twoFactorEnabled: true };
      const mockErrorResponse = {
        success: false,
        message: 'Invalid 2FA code'
      };

      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(mockErrorResponse)
      });

      render(<TwoFactorAuth user={enabledUser} onUpdate={mockOnUpdate} />);
      
      const disableButton = screen.getByRole('button', { name: /Disable 2FA/i });
      fireEvent.click(disableButton);
      
      const passwordInput = screen.getByLabelText(/Current Password/);
      const codeInput = screen.getByLabelText(/2FA Code/);
      
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(codeInput, { target: { value: '000000' } });
      
      const confirmButton = screen.getByRole('button', { name: /Confirm Disable/i });
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Invalid 2FA code');
      });
    });

    it('should handle disable request timeout (error path)', async () => {
      const enabledUser = { ...mockUser, twoFactorEnabled: true };
      
      fetch.mockImplementationOnce(() => new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 100);
      }));

      render(<TwoFactorAuth user={enabledUser} onUpdate={mockOnUpdate} />);
      
      const disableButton = screen.getByRole('button', { name: /Disable 2FA/i });
      fireEvent.click(disableButton);
      
      const passwordInput = screen.getByLabelText(/Current Password/);
      const codeInput = screen.getByLabelText(/2FA Code/);
      
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(codeInput, { target: { value: '123456' } });
      
      const confirmButton = screen.getByRole('button', { name: /Confirm Disable/i });
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Request timed out. Please try again.');
      });
    });
  });

  // TC-002: User can enable 2FA using authenticator apps
  describe('TC-002: Enable 2FA with Authenticator App', () => {
    it('should initiate TOTP setup and display QR code', async () => {
      const mockSetupResponse = {
        success: true,
        secret: 'JBSWY3DPEHPK3PXP',
        qrCode: 'data:image/png;base64,mockqrcode'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSetupResponse)
      });

      render(<TwoFactorAuth user={mockUser} onUpdate={mockOnUpdate} />);
      
      const enableButton = screen.getByRole('button', { name: /Enable 2FA/i });
      fireEvent.click(enableButton);
      
      const totpOption = screen.getByText(/Authenticator App/i);
      fireEvent.click(totpOption);
      
      await waitFor(() => {
        expect(screen.getByText(/Scan QR Code/)).toBeInTheDocument();
        expect(screen.getByText(/Enter the verification code/)).toBeInTheDocument();
      });

      expect(fetch).toHaveBeenCalledWith('/api/auth/2fa/setup-totp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        }
      });
    });

    it('should verify TOTP code and complete setup', async () => {
      const mockSetupResponse = {
        success: true,
        secret: 'JBSWY3DPEHPK3PXP',
        qrCode: 'data:image/png;base64,mockqrcode'
      };

      const mockVerifyResponse = {
        success: true,
        backupCodes: ['12345678', '87654321']
      };

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSetupResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockVerifyResponse)
        });

      render(<TwoFactorAuth user={mockUser} onUpdate={mockOnUpdate} />);
      
      // Start setup
      const enableButton = screen.getByRole('button', { name: /Enable 2FA/i });
      fireEvent.click(enableButton);
      
      const totpOption = screen.getByText(/Authenticator App/i);
      fireEvent.click(totpOption);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Verification Code/)).toBeInTheDocument();
      });

      // Enter verification code
      const codeInput = screen.getByLabelText(/Verification Code/);
      fireEvent.change(codeInput, { target: { value: '123456' } });
      
      const verifyButton = screen.getByRole('button', { name: /Verify & Enable/i });
      fireEvent.click(verifyButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/auth/2fa/verify-setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token'
          },
          body: JSON.stringify({ code: '123456' })
        });
      });

      expect(toast.success).toHaveBeenCalledWith('Two-factor authentication enabled successfully!');
      expect(mockOnUpdate).toHaveBeenCalled();
    });
  });

  // Error handling tests
  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      render(<TwoFactorAuth user={mockUser} onUpdate={mockOnUpdate} />);
      
      const enableButton = screen.getByRole('button', { name: /Enable 2FA/i });
      fireEvent.click(enableButton);
      
      const totpOption = screen.getByText(/Authenticator App/i);
      fireEvent.click(totpOption);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to setup 2FA. Please try again.');
      });
    });

    it('should handle invalid verification codes', async () => {
      const mockErrorResponse = {
        success: false,
        message: 'Invalid verification code'
      };

      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(mockErrorResponse)
      });

      render(<TwoFactorAuth user={mockUser} onUpdate={mockOnUpdate} />);
      
      // Simulate verification step with invalid code
      const codeInput = screen.getByLabelText(/Verification Code/) || document.createElement('input');
      fireEvent.change(codeInput, { target: { value: '000000' } });
      
      const verifyButton = screen.getByRole('button', { name: /Verify/i }) || document.createElement('button');
      fireEvent.click(verifyButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Invalid verification code');
      });
    });
  });
});