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

  // TC-005: Login flow requires 2FA code entry after successful password verification
  describe('TC-005: 2FA Login Flow', () => {
    it('should show 2FA input after successful password verification', async () => {
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

    it('should complete login with valid 2FA code', async () => {
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

    it('should show backup code option', async () => {
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
  });

  // TC-007: System displays clear error messages for invalid or expired 2FA codes
  describe('TC-007: Clear Error Messages for Invalid 2FA Codes', () => {
    it('should show error for invalid 2FA code format', async () => {
      renderLoginForm();

      // Enter invalid 2FA code (wrong length)
      const twoFactorInput = screen.getByLabelText(/verification code/i);
      fireEvent.change(twoFactorInput, {
        target: { value: '12345' } // Only 5 digits
      });
      fireEvent.blur(twoFactorInput);

      await waitFor(() => {
        expect(screen.getByText(/2fa code must be 6 digits/i)).toBeInTheDocument();
      });
    });

    it('should show error for expired/invalid 2FA code from server', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          message: 'Invalid or expired 2FA code'
        })
      });

      renderLoginForm();

      // Simulate 2FA state and submit invalid code
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
        expect(screen.getByText(/invalid or expired 2fa code/i)).toBeInTheDocument();
      });
    });

    it('should show error for invalid backup code', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          message: 'Invalid or used backup code'
        })
      });

      renderLoginForm();

      // Switch to backup code mode
      const component = screen.getByTestId('login-form');
      fireEvent.change(component, {
        target: { name: 'requiresTwoFactor', value: true }
      });
      fireEvent.click(screen.getByText(/use backup code/i));

      // Enter invalid backup code
      const backupCodeInput = screen.getByLabelText(/backup code/i);
      fireEvent.change(backupCodeInput, {
        target: { value: 'INVALID123' }
      });

      fireEvent.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid or used backup code/i)).toBeInTheDocument();
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