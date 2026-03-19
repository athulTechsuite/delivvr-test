import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Settings from '../Settings';
import { useTheme } from '../../../contexts/ThemeContext';

// Mock dependencies
jest.mock('../../../contexts/ThemeContext');

// Mock fetch globally
global.fetch = jest.fn();

const mockUseTheme = {
  theme: 'light',
  setTheme: jest.fn()
};

const renderSettings = () => {
  return render(<Settings />);
};

describe('Settings Component - 2FA Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTheme.mockReturnValue(mockUseTheme);
    fetch.mockClear();
  });

  // TC-001: User can enable 2FA from their account settings page
  describe('TC-001: Enable 2FA from Account Settings', () => {
    it('should display enable 2FA button when 2FA is disabled', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: false })
      });

      renderSettings();

      await waitFor(() => {
        expect(screen.getByText(/two-factor authentication/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /enable 2fa/i })).toBeInTheDocument();
      });
    });

    it('should initiate 2FA setup process when enable button is clicked', async () => {
      // Mock 2FA status check
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: false })
      });

      // Mock 2FA setup response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
          backupCodes: ['ABCD1234', 'EFGH5678', 'IJKL9012']
        })
      });

      renderSettings();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enable 2fa/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /enable 2fa/i }));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/auth/2fa/setup', {
          method: 'POST',
          credentials: 'include'
        });
      });
    });

    it('should handle setup errors gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: false })
      });

      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          message: 'Setup failed. Please try again.'
        })
      });

      renderSettings();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enable 2fa/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /enable 2fa/i }));

      await waitFor(() => {
        expect(screen.getByText(/setup failed. please try again/i)).toBeInTheDocument();
      });
    });
  });

  // TC-003: User receives a QR code to scan with their authenticator app during setup
  describe('TC-003: QR Code Display During Setup', () => {
    it('should display QR code after successful setup initiation', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: false })
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          qrCode: 'data:image/png;base64,mock-qr-code-data',
          backupCodes: ['ABCD1234', 'EFGH5678']
        })
      });

      renderSettings();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /enable 2fa/i }));
      });

      await waitFor(() => {
        const qrImage = screen.getByAltText(/qr code/i);
        expect(qrImage).toBeInTheDocument();
        expect(qrImage).toHaveAttribute('src', 'data:image/png;base64,mock-qr-code-data');
      });

      expect(screen.getByText(/scan this qr code/i)).toBeInTheDocument();
      expect(screen.getByText(/google authenticator/i)).toBeInTheDocument();
    });

    it('should display backup codes with QR code', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: false })
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          qrCode: 'data:image/png;base64,mock-qr-code-data',
          backupCodes: ['ABCD1234', 'EFGH5678', 'IJKL9012']
        })
      });

      renderSettings();

      fireEvent.click(screen.getByRole('button', { name: /enable 2fa/i }));

      await waitFor(() => {
        expect(screen.getByText(/backup codes/i)).toBeInTheDocument();
        expect(screen.getByText('ABCD1234')).toBeInTheDocument();
        expect(screen.getByText('EFGH5678')).toBeInTheDocument();
        expect(screen.getByText('IJKL9012')).toBeInTheDocument();
      });
    });
  });

  // TC-006: User can disable 2FA from their account settings with proper verification
  describe('TC-006: Disable 2FA with Verification', () => {
    it('should show disable option when 2FA is enabled', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: true })
      });

      renderSettings();

      await waitFor(() => {
        expect(screen.getByText(/2fa is currently enabled/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /disable 2fa/i })).toBeInTheDocument();
      });
    });

    it('should prompt for password when disabling 2FA', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: true })
      });

      renderSettings();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /disable 2fa/i }));
      });

      expect(screen.getByText(/enter your password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirm disable/i })).toBeInTheDocument();
    });

    it('should disable 2FA with valid password', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: true })
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Two-factor authentication disabled successfully'
        })
      });

      renderSettings();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /disable 2fa/i }));
      });

      const passwordInput = screen.getByLabelText(/password/i);
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      fireEvent.click(screen.getByRole('button', { name: /confirm disable/i }));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/auth/2fa/disable', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ password: 'password123' })
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/two-factor authentication disabled successfully/i)).toBeInTheDocument();
      });
    });

    it('should handle invalid password when disabling 2FA', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: true })
      });

      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          message: 'Invalid password'
        })
      });

      renderSettings();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /disable 2fa/i }));
      });

      const passwordInput = screen.getByLabelText(/password/i);
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });

      fireEvent.click(screen.getByRole('button', { name: /confirm disable/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid password/i)).toBeInTheDocument();
      });
    });
  });

  // TC-008: 2FA setup process includes clear instructions and help text
  describe('TC-008: Clear Instructions and Help Text', () => {
    it('should display clear setup instructions', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: false })
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          qrCode: 'data:image/png;base64,mock-qr-code-data',
          backupCodes: ['ABCD1234']
        })
      });

      renderSettings();

      fireEvent.click(screen.getByRole('button', { name: /enable 2fa/i }));

      await waitFor(() => {
        expect(screen.getByText(/step 1/i)).toBeInTheDocument();
        expect(screen.getByText(/download an authenticator app/i)).toBeInTheDocument();
        expect(screen.getByText(/step 2/i)).toBeInTheDocument();
        expect(screen.getByText(/scan the qr code/i)).toBeInTheDocument();
        expect(screen.getByText(/step 3/i)).toBeInTheDocument();
        expect(screen.getByText(/enter the verification code/i)).toBeInTheDocument();
      });
    });

    it('should provide help text for backup codes', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: false })
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          qrCode: 'data:image/png;base64,mock-qr-code-data',
          backupCodes: ['ABCD1234']
        })
      });

      renderSettings();

      fireEvent.click(screen.getByRole('button', { name: /enable 2fa/i }));

      await waitFor(() => {
        expect(screen.getByText(/save these backup codes/i)).toBeInTheDocument();
        expect(screen.getByText(/use them if you lose access/i)).toBeInTheDocument();
        expect(screen.getByText(/each code can only be used once/i)).toBeInTheDocument();
      });
    });

    it('should show verification step instructions', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: false })
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          qrCode: 'data:image/png;base64,mock-qr-code-data',
          backupCodes: ['ABCD1234']
        })
      });

      renderSettings();

      fireEvent.click(screen.getByRole('button', { name: /enable 2fa/i }));

      await waitFor(() => {
        expect(screen.getByText(/enter the 6-digit code/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
        expect(screen.getByText(/from your authenticator app/i)).toBeInTheDocument();
      });
    });
  });

  // 2FA Verification during setup
  describe('2FA Setup Verification', () => {
    it('should complete 2FA setup with valid verification code', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: false })
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          qrCode: 'data:image/png;base64,mock-qr-code-data',
          backupCodes: ['ABCD1234']
        })
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Two-factor authentication enabled successfully'
        })
      });

      renderSettings();

      fireEvent.click(screen.getByRole('button', { name: /enable 2fa/i }));

      await waitFor(() => {
        const verificationInput = screen.getByLabelText(/verification code/i);
        fireEvent.change(verificationInput, { target: { value: '123456' } });
        fireEvent.click(screen.getByRole('button', { name: /verify and enable/i }));
      });

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/auth/2fa/verify', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ token: '123456' })
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/two-factor authentication enabled successfully/i)).toBeInTheDocument();
      });
    });

    it('should handle invalid verification code during setup', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: false })
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          qrCode: 'data:image/png;base64,mock-qr-code-data',
          backupCodes: ['ABCD1234']
        })
      });

      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          message: 'Invalid 2FA code'
        })
      });

      renderSettings();

      fireEvent.click(screen.getByRole('button', { name: /enable 2fa/i }));

      await waitFor(() => {
        const verificationInput = screen.getByLabelText(/verification code/i);
        fireEvent.change(verificationInput, { target: { value: '000000' } });
        fireEvent.click(screen.getByRole('button', { name: /verify and enable/i }));
      });

      await waitFor(() => {
        expect(screen.getByText(/invalid 2fa code/i)).toBeInTheDocument();
      });
    });
  });

  // Loading states
  describe('Loading States', () => {
    it('should show loading state while checking 2FA status', async () => {
      fetch.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ enabled: false })
        }), 100);
      }));

      renderSettings();

      expect(screen.getByText(/loading/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });

    it('should show loading state during 2FA setup', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: false })
      });

      fetch.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true, qrCode: 'mock', backupCodes: [] })
        }), 100);
      }));

      renderSettings();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /enable 2fa/i }));
      });

      expect(screen.getByText(/setting up/i)).toBeInTheDocument();
    });
  });
});