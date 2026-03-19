import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LoginForm from '../LoginForm';
import { useAuth } from '../../../hooks/useAuth';
import { useTheme } from '../../../contexts/ThemeContext';

// Mock dependencies
jest.mock('../../../hooks/useAuth');
jest.mock('../../../contexts/ThemeContext');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn()
}));

// Mock fetch globally
global.fetch = jest.fn();

const mockLogin = jest.fn();
const mockUseAuth = {
  login: mockLogin,
  user: null,
  isLoading: false
};

const mockUseTheme = {
  theme: 'light',
  setTheme: jest.fn()
};

const renderLoginForm = () => {
  return render(
    <BrowserRouter>
      <LoginForm />
    </BrowserRouter>
  );
};

describe('LoginForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue(mockUseAuth);
    useTheme.mockReturnValue(mockUseTheme);
    fetch.mockClear();
  });

  // TC-001: 2FA setup and QR code generation
  describe('TC-001: 2FA Setup and QR Code Generation', () => {
    it('should successfully set up 2FA with QR code generation - Happy Path', async () => {
      // Mock password verification success
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          verified: true
        })
      });

      // Mock 2FA setup with QR code generation
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          secret: 'JBSWY3DPEHPK3PXP',
          qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
          backupCodes: ['12345678', '87654321', '11223344', '55667788', '99887766'],
          message: '2FA setup initiated'
        })
      });

      // Mock final 2FA confirmation
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: '2FA has been successfully enabled'
        })
      });

      renderLoginForm();

      // Navigate to 2FA setup
      fireEvent.click(screen.getByText(/enable two-factor authentication/i));

      // Enter password for verification
      fireEvent.change(screen.getByLabelText(/current password/i), {
        target: { value: 'currentpassword123' }
      });
      fireEvent.click(screen.getByRole('button', { name: /verify password/i }));

      await waitFor(() => {
        expect(screen.getByText(/scan this qr code/i)).toBeInTheDocument();
        expect(screen.getByAltText(/qr code/i)).toBeInTheDocument();
        expect(screen.getByText(/backup codes/i)).toBeInTheDocument();
        expect(screen.getByText(/12345678/i)).toBeInTheDocument();
      });

      // Complete 2FA setup with verification code
      fireEvent.change(screen.getByLabelText(/verification code/i), {
        target: { value: '123456' }
      });
      fireEvent.click(screen.getByRole('button', { name: /enable 2fa/i }));

      await waitFor(() => {
        expect(screen.getByText(/2fa has been successfully enabled/i)).toBeInTheDocument();
      });

      expect(fetch).toHaveBeenCalledWith('/api/auth/setup-2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: 'currentpassword123'
        })
      });

      expect(fetch).toHaveBeenCalledWith('/api/auth/confirm-2fa-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          twoFactorCode: '123456'
        })
      });
    });

    it('should handle 2FA setup failure - Error Path', async () => {
      // Mock password verification success
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          verified: true
        })
      });

      // Mock 2FA setup failure
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          success: false,
          message: 'Failed to initialize 2FA setup. Please try again.'
        })
      });

      renderLoginForm();

      fireEvent.click(screen.getByText(/enable two-factor authentication/i));
      fireEvent.change(screen.getByLabelText(/current password/i), {
        target: { value: 'currentpassword123' }
      });
      fireEvent.click(screen.getByRole('button', { name: /verify password/i }));

      await waitFor(() => {
        expect(screen.getByText(/failed to initialize 2fa setup/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });
    });

    it('should handle password verification failure during 2FA setup - Error Path', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          message: 'Invalid password provided'
        })
      });

      renderLoginForm();

      fireEvent.click(screen.getByText(/enable two-factor authentication/i));
      fireEvent.change(screen.getByLabelText(/current password/i), {
        target: { value: 'wrongpassword' }
      });
      fireEvent.click(screen.getByRole('button', { name: /verify password/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid password provided/i)).toBeInTheDocument();
        expect(screen.queryByText(/scan this qr code/i)).not.toBeInTheDocument();
      });
    });

    it('should handle 2FA confirmation failure - Error Path', async () => {
      // Mock successful setup initiation
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, verified: true })
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          secret: 'JBSWY3DPEHPK3PXP',
          qrCode: 'data:image/png;base64,test',
          backupCodes: ['12345678']
        })
      });

      // Mock confirmation failure
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          message: 'Invalid verification code. Please check your authenticator app.'
        })
      });

      renderLoginForm();

      fireEvent.click(screen.getByText(/enable two-factor authentication/i));
      fireEvent.change(screen.getByLabelText(/current password/i), {
        target: { value: 'password123' }
      });
      fireEvent.click(screen.getByRole('button', { name: /verify password/i }));

      await waitFor(() => {
        expect(screen.getByText(/scan this qr code/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/verification code/i), {
        target: { value: '000000' }
      });
      fireEvent.click(screen.getByRole('button', { name: /enable 2fa/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid verification code/i)).toBeInTheDocument();
        expect(screen.getByText(/check your authenticator app/i)).toBeInTheDocument();
      });
    });
  });

  // TC-002: Backup code generation and usage
  describe('TC-002: Backup Code Generation and Usage', () => {
    it('should generate backup codes during 2FA setup - Happy Path', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          backupCodes: [
            '12345678',
            '87654321', 
            '11223344',
            '55667788',
            '99887766',
            '44332211',
            '77889900',
            '66554433'
          ]
        })
      });

      renderLoginForm();

      fireEvent.click(screen.getByText(/generate backup codes/i));

      await waitFor(() => {
        expect(screen.getByText(/backup codes generated/i)).toBeInTheDocument();
        expect(screen.getByText(/12345678/i)).toBeInTheDocument();
        expect(screen.getByText(/87654321/i)).toBeInTheDocument();
        expect(screen.getByText(/save these codes in a secure location/i)).toBeInTheDocument();
        expect(screen.getByText(/each code can only be used once/i)).toBeInTheDocument();
      });

      // Test download functionality
      fireEvent.click(screen.getByRole('button', { name: /download codes/i }));
      expect(screen.getByText(/backup codes downloaded/i)).toBeInTheDocument();
    });

    it('should successfully use backup code for login - Happy Path', async () => {
      // Mock login requiring 2FA
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({
          success: true,
          requires2FA: true,
          tempToken: 'temp.jwt.token'
        })
      });

      // Mock successful backup code verification
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          token: 'final.jwt.token',
          user: {
            id: 'user123',
            email: 'test@example.com',
            name: 'John Doe'
          },
          message: 'Login successful with backup code'
        })
      });

      renderLoginForm();

      // Initial login
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'password123' }
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/use backup code/i)).toBeInTheDocument();
      });

      // Switch to backup code
      fireEvent.click(screen.getByText(/use backup code/i));

      expect(screen.getByText(/enter backup code/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/backup code/i)).toBeInTheDocument();

      // Enter backup code
      fireEvent.change(screen.getByLabelText(/backup code/i), {
        target: { value: '12345678' }
      });
      fireEvent.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(
          'final.jwt.token',
          expect.objectContaining({
            email: 'test@example.com'
          })
        );
      });

      expect(fetch).toHaveBeenCalledWith('/api/auth/verify-backup-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tempToken: 'temp.jwt.token',
          backupCode: '12345678'
        })
      });
    });

    it('should regenerate backup codes when requested - Happy Path', async () => {
      // Mock current codes
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          backupCodes: ['old12345', 'old67890', 'old11111']
        })
      });

      // Mock regenerated codes
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          backupCodes: ['new12345', 'new67890', 'new11111'],
          message: 'New backup codes generated successfully'
        })
      });

      renderLoginForm();

      fireEvent.click(screen.getByText(/view backup codes/i));

      await waitFor(() => {
        expect(screen.getByText(/old12345/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /regenerate codes/i }));

      // Confirm regeneration
      fireEvent.click(screen.getByRole('button', { name: /confirm regenerate/i }));

      await waitFor(() => {
        expect(screen.getByText(/new12345/i)).toBeInTheDocument();
        expect(screen.queryByText(/old12345/i)).not.toBeInTheDocument();
        expect(screen.getByText(/new backup codes generated successfully/i)).toBeInTheDocument();
      });

      expect(fetch).toHaveBeenCalledWith('/api/auth/regenerate-backup-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });

    it('should handle backup code generation failure - Error Path', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          success: false,
          message: 'Failed to generate backup codes. Server error occurred.'
        })
      });

      renderLoginForm();

      fireEvent.click(screen.getByText(/generate backup codes/i));

      await waitFor(() => {
        expect(screen.getByText(/failed to generate backup codes/i)).toBeInTheDocument();
        expect(screen.getByText(/server error occurred/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });
    });

    it('should handle invalid backup code during login - Error Path', async () => {
      // Mock login requiring 2FA
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({
          success: true,
          requires2FA: true,
          tempToken: 'temp.jwt.token'
        })
      });

      // Mock invalid backup code
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          message: 'Invalid or already used backup code'
        })
      });

      renderLoginForm();

      // Initial login and switch to backup code
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'password123' }
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/use backup code/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/use backup code/i));

      // Enter invalid backup code
      fireEvent.change(screen.getByLabelText(/backup code/i), {
        target: { value: 'INVALID1' }
      });
      fireEvent.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid or already used backup code/i)).toBeInTheDocument();
        expect(screen.getByText(/please try another code/i)).toBeInTheDocument();
      });
    });

    it('should handle backup code regeneration failure - Error Path', async () => {
      // Mock current codes success
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          backupCodes: ['code12345']
        })
      });

      // Mock regeneration failure
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          success: false,
          message: 'Insufficient permissions to regenerate backup codes'
        })
      });

      renderLoginForm();

      fireEvent.click(screen.getByText(/view backup codes/i));
      
      await waitFor(() => {
        expect(screen.getByText(/code12345/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /regenerate codes/i }));
      fireEvent.click(screen.getByRole('button', { name: /confirm regenerate/i }));

      await waitFor(() => {
        expect(screen.getByText(/insufficient permissions/i)).toBeInTheDocument();
        expect(screen.getByText(/contact support if this persists/i)).toBeInTheDocument();
      });
    });
  });

  // TC-007: System displays clear error messages for invalid or expired 2FA codes
  describe('TC-007: Clear Error Messages for Invalid or Expired 2FA Codes', () => {
    it('should show specific error for invalid 2FA code format - Error Path', async () => {
      renderLoginForm();

      // Simulate 2FA state
      const component = screen.getByTestId('login-form');
      fireEvent.change(component, {
        target: { name: 'requiresTwoFactor', value: true }
      });

      // Test various invalid formats
      const twoFactorInput = screen.getByLabelText(/verification code/i);
      
      // Wrong length
      fireEvent.change(twoFactorInput, {
        target: { value: '12345' }
      });
      fireEvent.blur(twoFactorInput);

      await waitFor(() => {
        expect(screen.getByText(/2fa code must be exactly 6 digits/i)).toBeInTheDocument();
      });

      // Non-numeric characters
      fireEvent.change(twoFactorInput, {
        target: { value: 'abc123' }
      });
      fireEvent.blur(twoFactorInput);

      await waitFor(() => {
        expect(screen.getByText(/2fa code must contain only numbers/i)).toBeInTheDocument();
      });

      // Special characters
      fireEvent.change(twoFactorInput, {
        target: { value: '12-456' }
      });
      fireEvent.blur(twoFactorInput);

      await waitFor(() => {
        expect(screen.getByText(/2fa code must contain only numbers/i)).toBeInTheDocument();
      });
    });

    it('should show clear error for expired 2FA code from server - Error Path', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: 'EXPIRED_CODE',
          message: 'The 2FA code has expired. Please generate a new code from your authenticator app.',
          remainingAttempts: 2
        })
      });

      renderLoginForm();

      // Simulate 2FA state
      const component = screen.getByTestId('login-form');
      fireEvent.change(component, {
        target: { name: 'requiresTwoFactor', value: true }
      });

      const twoFactorInput = screen.getByLabelText(/verification code/i);
      fireEvent.change(twoFactorInput, {
        target: { value: '123456' }
      });

      fireEvent.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(screen.getByText(/the 2fa code has expired/i)).toBeInTheDocument();
        expect(screen.getByText(/generate a new code from your authenticator app/i)).toBeInTheDocument();
        expect(screen.getByText(/2 attempts remaining/i)).toBeInTheDocument();
      });
    });

    it('should show clear error for incorrect 2FA code - Error Path', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: 'INVALID_CODE',
          message: 'The 2FA code is incorrect. Please check your authenticator app and try again.',
          remainingAttempts: 1
        })
      });

      renderLoginForm();

      const component = screen.getByTestId('login-form');
      fireEvent.change(component, {
        target: { name: 'requiresTwoFactor', value: true }
      });

      const twoFactorInput = screen.getByLabelText(/verification code/i);
      fireEvent.change(twoFactorInput, {
        target: { value: '000000' }
      });

      fireEvent.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(screen.getByText(/the 2fa code is incorrect/i)).toBeInTheDocument();
        expect(screen.getByText(/check your authenticator app and try again/i)).toBeInTheDocument();
        expect(screen.getByText(/1 attempt remaining/i)).toBeInTheDocument();
        expect(screen.getByText(/account will be temporarily locked after next failed attempt/i)).toBeInTheDocument();
      });
    });

    it('should show account lockout warning for too many failed attempts - Error Path', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          success: false,
          error: 'TOO_MANY_ATTEMPTS',
          message: 'Too many failed 2FA attempts. Account temporarily locked for 15 minutes.',
          lockoutDuration: 900
        })
      });

      renderLoginForm();

      const component = screen.getByTestId('login-form');
      fireEvent.change(component, {
        target: { name: 'requiresTwoFactor', value: true }
      });

      const twoFactorInput = screen.getByLabelText(/verification code/i);
      fireEvent.change(twoFactorInput, {
        target: { value: '999999' }
      });

      fireEvent.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(screen.getByText(/too many failed 2fa attempts/i)).toBeInTheDocument();
        expect(screen.getByText(/account temporarily locked for 15 minutes/i)).toBeInTheDocument();
        expect(screen.getByText(/use backup code instead/i)).toBeInTheDocument();
      });
    });

    it('should show network error message - Error Path', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      renderLoginForm();

      const component = screen.getByTestId('login-form');
      fireEvent.change(component, {
        target: { name: 'requiresTwoFactor', value: true }
      });

      const twoFactorInput = screen.getByLabelText(/verification code/i);
      fireEvent.change(twoFactorInput, {
        target: { value: '123456' }
      });

      fireEvent.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(screen.getByText(/network error occurred/i)).toBeInTheDocument();
        expect(screen.getByText(/check your internet connection and try again/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should successfully validate and accept correct 2FA code - Happy Path', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          token: 'final.jwt.token',
          user: {
            id: 'user123',
            email: 'test@example.com'
          },
          message: '2FA verification successful'
        })
      });

      renderLoginForm();

      const component = screen.getByTestId('login-form');
      fireEvent.change(component, {
        target: { name: 'requiresTwoFactor', value: true }
      });

      const twoFactorInput = screen.getByLabelText(/verification code/i);
      fireEvent.change(twoFactorInput, {
        target: { value: '123456' }
      });

      // Should not show validation errors for correct format
      fireEvent.blur(twoFactorInput);

      await waitFor(() => {
        expect(screen.queryByText(/2fa code must be/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/must contain only numbers/i)).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(
          'final.jwt.token',
          expect.objectContaining({
            email: 'test@example.com'
          })
        );
      });
    });

    it('should show helpful error message for server timeout - Error Path', async () => {
      fetch.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      renderLoginForm();

      const component = screen.getByTestId('login-form');
      fireEvent.change(component, {
        target: { name: 'requiresTwoFactor', value: true }
      });

      const twoFactorInput = screen.getByLabelText(/verification code/i);
      fireEvent.change(twoFactorInput, {
        target: { value: '123456' }
      });

      fireEvent.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(screen.getByText(/request timed out/i)).toBeInTheDocument();
        expect(screen.getByText(/server may be temporarily unavailable/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });
    });
  });

  // TC-004: 2FA disable functionality
  describe('TC-004: 2FA Disable Functionality', () => {
    it('should disable 2FA after password and code verification - Happy Path', async () => {
      // Mock password verification
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          verified: true
        })
      });

      // Mock 2FA disable success
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: '2FA has been disabled'
        })
      });

      renderLoginForm();

      fireEvent.click(screen.getByText(/disable two-factor authentication/i));

      // Enter password
      fireEvent.change(screen.getByLabelText(/current password/i), {
        target: { value: 'password123' }
      });

      // Enter 2FA code
      fireEvent.change(screen.getByLabelText(/verification code/i), {
        target: { value: '123456' }
      });

      fireEvent.click(screen.getByRole('button', { name: /disable 2fa/i }));

      await waitFor(() => {
        expect(screen.getByText(/2fa has been disabled/i)).toBeInTheDocument();
      });

      expect(fetch).toHaveBeenCalledWith('/api/auth/disable-2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: 'password123',
          twoFactorCode: '123456'
        })
      });
    });

    it('should show confirmation dialog before disabling 2FA', async () => {
      renderLoginForm();

      fireEvent.click(screen.getByText(/disable two-factor authentication/i));

      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      expect(screen.getByText(/this will make your account less secure/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
    });

    it('should handle 2FA disable failure - Error Path', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          message: 'Invalid verification code'
        })
      });

      renderLoginForm();

      fireEvent.click(screen.getByText(/disable two-factor authentication/i));
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));

      fireEvent.change(screen.getByLabelText(/current password/i), {
        target: { value: 'password123' }
      });
      fireEvent.change(screen.getByLabelText(/verification code/i), {
        target: { value: '000000' }
      });

      fireEvent.click(screen.getByRole('button', { name: /disable 2fa/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid verification code/i)).toBeInTheDocument();
      });
    });
  });

  // TC-005: Login flow requires 2FA code entry after successful password verification
  describe('TC-005: 2FA Login Flow', () => {
    it('should show 2FA input after successful password verification - Happy Path', async () => {
      // Mock initial login response requiring 2FA
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({
          success: true,
          requires2FA: true,
          tempToken: 'temp.jwt.token',
          message: '2FA code required'
        })
      });

      renderLoginForm();

      // Fill in email and password
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'password123' }
      });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      // Wait for 2FA form to appear
      await waitFor(() => {
        expect(screen.getByText(/enter verification code/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
      });

      expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123'
        })
      });
    });

    it('should complete login with valid 2FA code - Happy Path', async () => {
      // Mock successful 2FA verification
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          token: 'final.jwt.token',
          user: {
            id: 'user123',
            email: 'test@example.com',
            name: 'John Doe'
          }
        })
      });

      renderLoginForm();

      // Simulate being in 2FA state
      const component = screen.getByTestId('login-form');
      fireEvent.change(component, {
        target: { name: 'requiresTwoFactor', value: true }
      });

      // Enter 2FA code
      const twoFactorInput = screen.getByLabelText(/verification code/i);
      fireEvent.change(twoFactorInput, {
        target: { value: '123456' }
      });

      // Submit 2FA code
      fireEvent.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(
          'final.jwt.token',
          expect.objectContaining({
            email: 'test@example.com'
          })
        );
      });
    });

    it('should show backup code option - Happy Path', async () => {
      renderLoginForm();

      // Simulate 2FA state
      const component = screen.getByTestId('login-form');
      fireEvent.change(component, {
        target: { name: 'requiresTwoFactor', value: true }
      });

      // Check for backup code link
      expect(screen.getByText(/use backup code/i)).toBeInTheDocument();

      // Click backup code link
      fireEvent.click(screen.getByText(/use backup code/i));

      expect(screen.getByText(/enter backup code/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/backup code/i)).toBeInTheDocument();
    });

    it('should handle login failure before 2FA - Error Path', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          message: 'Invalid email or password'
        })
      });

      renderLoginForm();

      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'wrongpassword' }
      });

      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
        expect(screen.queryByText(/enter verification code/i)).not.toBeInTheDocument();
      });
    });
  });

  // TC-008: 2FA setup process includes clear instructions and help text
  describe('TC-008: Clear Instructions and Help Text', () => {
    it('should display helpful instructions during 2FA login', async () => {
      renderLoginForm();

      // Simulate 2FA state
      const component = screen.getByTestId('login-form');
      fireEvent.change(component, {
        target: { name: 'requiresTwoFactor', value: true }
      });

      // Check for instructional text
      expect(screen.getByText(/enter the 6-digit code/i)).toBeInTheDocument();
      expect(screen.getByText(/from your authenticator app/i)).toBeInTheDocument();
      expect(screen.getByText(/having trouble/i)).toBeInTheDocument();
    });

    it('should show backup code instructions when switching to backup mode', async () => {
      renderLoginForm();

      // Switch to backup code mode
      const component = screen.getByTestId('login-form');
      fireEvent.change(component, {
        target: { name: 'requiresTwoFactor', value: true }
      });
      fireEvent.click(screen.getByText(/use backup code/i));

      expect(screen.getByText(/enter one of your backup codes/i)).toBeInTheDocument();
      expect(screen.getByText(/backup codes are 8 characters/i)).toBeInTheDocument();
    });
  });

  // Form validation tests
  describe('Form Validation', () => {
    it('should validate email format', async () => {
      renderLoginForm();

      const emailInput = screen.getByLabelText(/email/i);
      fireEvent.change(emailInput, {
        target: { value: 'invalid-email' }
      });
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(screen.getByText(/email is invalid/i)).toBeInTheDocument();
      });
    });

    it('should validate password length', async () => {
      renderLoginForm();

      const passwordInput = screen.getByLabelText(/password/i);
      fireEvent.change(passwordInput, {
        target: { value: '12345' } // Too short
      });
      fireEvent.blur(passwordInput);

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument();
      });
    });

    it('should validate 2FA code format', async () => {
      renderLoginForm();

      // Simulate 2FA state
      const component = screen.getByTestId('login-form');
      fireEvent.change(component, {
        target: { name: 'requiresTwoFactor', value: true }
      });

      const twoFactorInput = screen.getByLabelText(/verification code/i);
      fireEvent.change(twoFactorInput, {
        target: { value: 'abc123' } // Non-numeric
      });
      fireEvent.blur(twoFactorInput);

      await waitFor(() => {
        expect(screen.getByText(/2fa code must be 6 digits/i)).toBeInTheDocument();
      });
    });
  });

  // Loading states
  describe('Loading States', () => {
    it('should show loading state during login', async () => {
      fetch.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true })
        }), 100);
      }));

      renderLoginForm();

      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'password123' }
      });

      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      expect(screen.getByText(/signing in/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
    });

    it('should show loading state during 2FA verification', async () => {
      fetch.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true })
        }), 100);
      }));

      renderLoginForm();

      // Simulate 2FA state
      const component = screen.getByTestId('login-form');
      fireEvent.change(component, {
        target: { name: 'requiresTwoFactor', value: true }
      });

      const twoFactorInput = screen.getByLabelText(/verification code/i);
      fireEvent.change(twoFactorInput, {
        target: { value: '123456' }
      });

      fireEvent.click(screen.getByRole('button', { name: /verify/i }));

      expect(screen.getByText(/verifying/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /verifying/i })).toBeDisabled();
    });
  });
});