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

  // TC-001: User can navigate to security settings and find 2FA options
  describe('TC-001: 2FA Options Visibility', () => {
    it('should display 2FA options when not enabled', () => {
      render(<TwoFactorAuth user={mockUser} onUpdate={mockOnUpdate} />);
      
      expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
      expect(screen.getByText(/Add an extra layer of security/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Enable 2FA/i })).toBeInTheDocument();
    });

    it('should display 2FA management options when enabled', () => {
      const enabledUser = { ...mockUser, twoFactorEnabled: true };
      render(<TwoFactorAuth user={enabledUser} onUpdate={mockOnUpdate} />);
      
      expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
      expect(screen.getByText(/2FA is currently enabled/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Disable 2FA/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Regenerate Backup Codes/i })).toBeInTheDocument();
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

  // TC-003: User can enable 2FA using SMS verification
  describe('TC-003: Enable 2FA with SMS', () => {
    it('should setup SMS 2FA with phone number', async () => {
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

    it('should validate phone number format', async () => {
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
  });

  // TC-004: System generates and displays QR code for authenticator setup
  describe('TC-004: QR Code Generation and Display', () => {
    it('should display QR code during TOTP setup', async () => {
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
        const qrImage = screen.getByAltText(/QR Code/);
        expect(qrImage).toBeInTheDocument();
        expect(qrImage.src).toBe('data:image/png;base64,mockqrcode');
      });

      expect(screen.getByText(/Scan this QR code/)).toBeInTheDocument();
      expect(screen.getByText(/JBSWY3DPEHPK3PXP/)).toBeInTheDocument();
    });
  });

  // TC-006: User can generate backup recovery codes
  describe('TC-006: Backup Recovery Codes', () => {
    it('should display backup codes after successful setup', async () => {
      const mockVerifyResponse = {
        success: true,
        backupCodes: ['ABC12345', 'DEF67890', 'GHI13579']
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockVerifyResponse)
      });

      render(<TwoFactorAuth user={mockUser} onUpdate={mockOnUpdate} />);
      
      // Simulate completing verification
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

    it('should allow regenerating backup codes', async () => {
      const enabledUser = { ...mockUser, twoFactorEnabled: true };
      const mockRegenerateResponse = {
        success: true,
        backupCodes: ['NEW12345', 'NEW67890']
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
  });

  // TC-008: User can disable 2FA after providing current password and 2FA code
  describe('TC-008: Disable 2FA', () => {
    it('should show disable confirmation dialog', () => {
      const enabledUser = { ...mockUser, twoFactorEnabled: true };
      render(<TwoFactorAuth user={enabledUser} onUpdate={mockOnUpdate} />);
      
      const disableButton = screen.getByRole('button', { name: /Disable 2FA/i });
      fireEvent.click(disableButton);
      
      expect(screen.getByText(/Disable Two-Factor Authentication/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Current Password/)).toBeInTheDocument();
      expect(screen.getByLabelText(/2FA Code/)).toBeInTheDocument();
    });

    it('should disable 2FA with valid credentials', async () => {
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