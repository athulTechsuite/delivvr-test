import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import TwoFactorAuth from '../../src/components/Settings/TwoFactorAuth';
import * as authAPI from '../../src/services/authAPI';

// Mock the auth API
jest.mock('../../src/services/authAPI');
const mockAuthAPI = authAPI;

// Mock QR code canvas
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => ({
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    getImageData: jest.fn(),
    putImageData: jest.fn(),
    createImageData: jest.fn(),
    setTransform: jest.fn(),
    drawImage: jest.fn(),
    save: jest.fn(),
    fillText: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
  }),
});

describe('TwoFactorAuth Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TC-001: Enable 2FA from settings page', () => {
    it('should display enable 2FA button when 2FA is disabled', () => {
      mockAuthAPI.get2FAStatus = jest.fn().mockResolvedValue({
        isEnabled: false
      });

      render(<TwoFactorAuth />);

      expect(screen.getByText('Enable Two-Factor Authentication')).toBeInTheDocument();
      expect(screen.getByText('Add an extra layer of security to your account')).toBeInTheDocument();
    });

    it('should show setup form when enable button is clicked', async () => {
      mockAuthAPI.get2FAStatus = jest.fn().mockResolvedValue({
        isEnabled: false
      });

      render(<TwoFactorAuth />);

      const enableButton = screen.getByText('Enable Two-Factor Authentication');
      fireEvent.click(enableButton);

      await waitFor(() => {
        expect(screen.getByText('Enter Current Password')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Current password')).toBeInTheDocument();
      });
    });

    it('should display 2FA status when enabled', async () => {
      mockAuthAPI.get2FAStatus = jest.fn().mockResolvedValue({
        isEnabled: true,
        enabledAt: '2023-12-01T00:00:00Z'
      });

      render(<TwoFactorAuth />);

      await waitFor(() => {
        expect(screen.getByText('Two-Factor Authentication is enabled')).toBeInTheDocument();
        expect(screen.getByText('Disable')).toBeInTheDocument();
        expect(screen.getByText('Regenerate Backup Codes')).toBeInTheDocument();
      });
    });
  });

  describe('TC-003: QR code and manual entry setup', () => {
    it('should display QR code and manual key after password verification', async () => {
      const mockSetupData = {
        qrCode: 'data:image/png;base64,mockedqrcode',
        manualEntryKey: 'JBSWY3DPEHPK3PXP',
        backupCodes: ['CODE1234', 'CODE5678', 'CODE9012', 'CODE3456', 'CODE7890', 'CODE1357', 'CODE2468', 'CODE8642', 'CODE9753', 'CODE0246']
      };

      mockAuthAPI.get2FAStatus = jest.fn().mockResolvedValue({ isEnabled: false });
      mockAuthAPI.setup2FA = jest.fn().mockResolvedValue(mockSetupData);

      render(<TwoFactorAuth />);

      // Click enable button
      const enableButton = screen.getByText('Enable Two-Factor Authentication');
      fireEvent.click(enableButton);

      // Enter password
      await waitFor(() => {
        const passwordInput = screen.getByPlaceholderText('Current password');
        fireEvent.change(passwordInput, { target: { value: 'userpassword' } });

        const nextButton = screen.getByText('Next');
        fireEvent.click(nextButton);
      });

      // Verify QR code and manual key are displayed
      await waitFor(() => {
        expect(screen.getByText('Scan QR Code')).toBeInTheDocument();
        expect(screen.getByText('Manual Entry')).toBeInTheDocument();
        expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();
        expect(screen.getByAltText('2FA QR Code')).toBeInTheDocument();
      });
    });

    it('should allow switching between QR code and manual entry tabs', async () => {
      const mockSetupData = {
        qrCode: 'data:image/png;base64,mockedqrcode',
        manualEntryKey: 'JBSWY3DPEHPK3PXP',
        backupCodes: ['CODE1234', 'CODE5678', 'CODE9012', 'CODE3456', 'CODE7890', 'CODE1357', 'CODE2468', 'CODE8642', 'CODE9753', 'CODE0246']
      };

      mockAuthAPI.get2FAStatus = jest.fn().mockResolvedValue({ isEnabled: false });
      mockAuthAPI.setup2FA = jest.fn().mockResolvedValue(mockSetupData);

      render(<TwoFactorAuth />);

      // Navigate to setup
      fireEvent.click(screen.getByText('Enable Two-Factor Authentication'));
      
      await waitFor(async () => {
        fireEvent.change(screen.getByPlaceholderText('Current password'), { 
          target: { value: 'userpassword' } 
        });
        fireEvent.click(screen.getByText('Next'));
      });

      await waitFor(() => {
        // Initially on QR code tab
        expect(screen.getByAltText('2FA QR Code')).toBeInTheDocument();

        // Switch to manual entry tab
        fireEvent.click(screen.getByText('Manual Entry'));
        expect(screen.getByText('Enter this key in your authenticator app:')).toBeInTheDocument();
        expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();

        // Switch back to QR tab
        fireEvent.click(screen.getByText('Scan QR Code'));
        expect(screen.getByAltText('2FA QR Code')).toBeInTheDocument();
      });
    });
  });

  describe('TC-004: Password requirement validation', () => {
    it('should show error for empty password', async () => {
      mockAuthAPI.get2FAStatus = jest.fn().mockResolvedValue({ isEnabled: false });

      render(<TwoFactorAuth />);

      fireEvent.click(screen.getByText('Enable Two-Factor Authentication'));

      await waitFor(() => {
        fireEvent.click(screen.getByText('Next'));
        expect(screen.getByText('Password is required')).toBeInTheDocument();
      });
    });

    it('should show error for incorrect password', async () => {
      mockAuthAPI.get2FAStatus = jest.fn().mockResolvedValue({ isEnabled: false });
      mockAuthAPI.setup2FA = jest.fn().mockRejectedValue({
        response: { data: { message: 'Invalid password' } }
      });

      render(<TwoFactorAuth />);

      fireEvent.click(screen.getByText('Enable Two-Factor Authentication'));

      await waitFor(() => {
        fireEvent.change(screen.getByPlaceholderText('Current password'), {
          target: { value: 'wrongpassword' }
        });
        fireEvent.click(screen.getByText('Next'));
      });

      await waitFor(() => {
        expect(screen.getByText('Invalid password')).toBeInTheDocument();
      });
    });
  });

  describe('TC-005: Backup codes display and download', () => {
    it('should display backup codes after successful setup', async () => {
      const mockSetupData = {
        qrCode: 'data:image/png;base64,mockedqrcode',
        manualEntryKey: 'JBSWY3DPEHPK3PXP',
        backupCodes: ['CODE1234', 'CODE5678', 'CODE9012', 'CODE3456', 'CODE7890', 'CODE1357', 'CODE2468', 'CODE8642', 'CODE9753', 'CODE0246']
      };

      mockAuthAPI.get2FAStatus = jest.fn().mockResolvedValue({ isEnabled: false });
      mockAuthAPI.setup2FA = jest.fn().mockResolvedValue(mockSetupData);
      mockAuthAPI.verify2FASetup = jest.fn().mockResolvedValue({ success: true });

      render(<TwoFactorAuth />);

      // Complete setup flow
      fireEvent.click(screen.getByText('Enable Two-Factor Authentication'));
      
      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText('Current password'), {
          target: { value: 'userpassword' }
        });
        fireEvent.click(screen.getByText('Next'));
      });

      await waitFor(async () => {
        fireEvent.change(screen.getByPlaceholderText('Enter 6-digit code'), {
          target: { value: '123456' }
        });
        fireEvent.click(screen.getByText('Verify & Enable'));
      });

      // Check backup codes are displayed
      await waitFor(() => {
        expect(screen.getByText('Save Your Backup Codes')).toBeInTheDocument();
        expect(screen.getByText('CODE1234')).toBeInTheDocument();
        expect(screen.getByText('CODE5678')).toBeInTheDocument();
        expect(screen.getAllByText(/CODE\d{4}/)).toHaveLength(10);
      });
    });

    it('should provide download backup codes functionality', async () => {
      const mockSetupData = {
        qrCode: 'data:image/png;base64,mockedqrcode',
        manualEntryKey: 'JBSWY3DPEHPK3PXP',
        backupCodes: ['CODE1234', 'CODE5678', 'CODE9012', 'CODE3456', 'CODE7890', 'CODE1357', 'CODE2468', 'CODE8642', 'CODE9753', 'CODE0246']
      };

      // Mock URL.createObjectURL for download functionality
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = jest.fn();
      
      // Mock createElement and click for download
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn()
      };
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink);

      mockAuthAPI.get2FAStatus = jest.fn().mockResolvedValue({ isEnabled: false });
      mockAuthAPI.setup2FA = jest.fn().mockResolvedValue(mockSetupData);
      mockAuthAPI.verify2FASetup = jest.fn().mockResolvedValue({ success: true });

      render(<TwoFactorAuth />);

      // Complete setup to backup codes step
      fireEvent.click(screen.getByText('Enable Two-Factor Authentication'));
      
      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText('Current password'), {
          target: { value: 'userpassword' }
        });
        fireEvent.click(screen.getByText('Next'));
      });

      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText('Enter 6-digit code'), {
          target: { value: '123456' }
        });
        fireEvent.click(screen.getByText('Verify & Enable'));
      });

      await waitFor(() => {
        const downloadButton = screen.getByText('Download Codes');
        fireEvent.click(downloadButton);

        expect(document.createElement).toHaveBeenCalledWith('a');
        expect(mockLink.click).toHaveBeenCalled();
        expect(mockLink.download).toBe('delivvr-backup-codes.txt');
      });
    });

    it('should require acknowledgment before completing setup', async () => {
      const mockSetupData = {
        qrCode: 'data:image/png;base64,mockedqrcode',
        manualEntryKey: 'JBSWY3DPEHPK3PXP',
        backupCodes: ['CODE1234', 'CODE5678', 'CODE9012', 'CODE3456', 'CODE7890', 'CODE1357', 'CODE2468', 'CODE8642', 'CODE9753', 'CODE0246']
      };

      mockAuthAPI.get2FAStatus = jest.fn().mockResolvedValue({ isEnabled: false });
      mockAuthAPI.setup2FA = jest.fn().mockResolvedValue(mockSetupData);
      mockAuthAPI.verify2FASetup = jest.fn().mockResolvedValue({ success: true });

      render(<TwoFactorAuth />);

      // Complete setup flow to backup codes
      fireEvent.click(screen.getByText('Enable Two-Factor Authentication'));
      
      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText('Current password'), {
          target: { value: 'userpassword' }
        });
        fireEvent.click(screen.getByText('Next'));
      });

      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText('Enter 6-digit code'), {
          target: { value: '123456' }
        });
        fireEvent.click(screen.getByText('Verify & Enable'));
      });

      await waitFor(() => {
        const finishButton = screen.getByText('I\'ve Saved My Codes');
        expect(finishButton).toBeInTheDocument();
        
        // Complete setup
        fireEvent.click(finishButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Two-Factor Authentication is enabled')).toBeInTheDocument();
      });
    });
  });

  describe('TC-007: Disable 2FA functionality', () => {
    it('should show disable 2FA form when disable button is clicked', async () => {
      mockAuthAPI.get2FAStatus = jest.fn().mockResolvedValue({
        isEnabled: true,
        enabledAt: '2023-12-01T00:00:00Z'
      });

      render(<TwoFactorAuth />);

      await waitFor(() => {
        fireEvent.click(screen.getByText('Disable'));
      });

      await waitFor(() => {
        expect(screen.getByText('Disable Two-Factor Authentication')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Current password')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('6-digit code from your authenticator')).toBeInTheDocument();
      });
    });

    it('should successfully disable 2FA with valid credentials', async () => {
      mockAuthAPI.get2FAStatus = jest.fn()
        .mockResolvedValueOnce({ isEnabled: true })
        .mockResolvedValueOnce({ isEnabled: false });
      mockAuthAPI.disable2FA = jest.fn().mockResolvedValue({ success: true });

      render(<TwoFactorAuth />);

      await waitFor(() => {
        fireEvent.click(screen.getByText('Disable'));
      });

      await waitFor(() => {
        fireEvent.change(screen.getByPlaceholderText('Current password'), {
          target: { value: 'userpassword' }
        });
        fireEvent.change(screen.getByPlaceholderText('6-digit code from your authenticator'), {
          target: { value: '123456' }
        });
        fireEvent.click(screen.getByText('Disable 2FA'));
      });

      await waitFor(() => {
        expect(mockAuthAPI.disable2FA).toHaveBeenCalledWith({
          password: 'userpassword',
          twoFactorCode: '123456'
        });
        expect(screen.getByText('Two-Factor Authentication has been disabled')).toBeInTheDocument();
      });
    });
  });

  describe('TC-009: Regenerate backup codes', () => {
    it('should allow regenerating backup codes when 2FA is enabled', async () => {
      const newBackupCodes = ['NEW1234', 'NEW5678', 'NEW9012', 'NEW3456', 'NEW7890', 'NEW1357', 'NEW2468', 'NEW8642', 'NEW9753', 'NEW0246'];
      
      mockAuthAPI.get2FAStatus = jest.fn().mockResolvedValue({
        isEnabled: true,
        enabledAt: '2023-12-01T00:00:00Z'
      });
      mockAuthAPI.regenerateBackupCodes = jest.fn().mockResolvedValue({
        backupCodes: newBackupCodes
      });

      render(<TwoFactorAuth />);

      await waitFor(() => {
        fireEvent.click(screen.getByText('Regenerate Backup Codes'));
      });

      await waitFor(() => {
        fireEvent.change(screen.getByPlaceholderText('Current password'), {
          target: { value: 'userpassword' }
        });
        fireEvent.change(screen.getByPlaceholderText('6-digit code from your authenticator'), {
          target: { value: '123456' }
        });
        fireEvent.click(screen.getByText('Regenerate Codes'));
      });

      await waitFor(() => {
        expect(mockAuthAPI.regenerateBackupCodes).toHaveBeenCalledWith({
          password: 'userpassword',
          twoFactorCode: '123456'
        });
        expect(screen.getByText('NEW1234')).toBeInTheDocument();
        expect(screen.getByText('Download New Codes')).toBeInTheDocument();
      });
    });
  });
});