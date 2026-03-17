import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeContext } from '../../../contexts/ThemeContext';
import ThemeSettings from '../ThemeSettings';

// Mock the CSS import
jest.mock('../ThemeSettings.css', () => ({}));

const mockSetTheme = jest.fn();
const mockThemeContext = {
  theme: 'light',
  setTheme: mockSetTheme,
  effectiveTheme: 'light'
};

const ThemeSettingsWithProvider = ({ themeValue = 'light' }) => (
  <ThemeContext.Provider value={{ ...mockThemeContext, theme: themeValue }}>
    <ThemeSettings />
  </ThemeContext.Provider>
);

describe('ThemeSettings Component', () => {
  beforeEach(() => {
    mockSetTheme.mockClear();
  });
  
  describe('TC-001: User can access theme settings from the main app settings menu', () => {
    it('should render theme settings component with proper heading', () => {
      render(<ThemeSettingsWithProvider />);
      
      expect(screen.getByRole('heading', { name: /theme/i })).toBeInTheDocument();
      expect(screen.getByText(/choose your preferred appearance/i)).toBeInTheDocument();
    });
    
    it('should display all theme options', () => {
      render(<ThemeSettingsWithProvider />);
      
      expect(screen.getByText('Light')).toBeInTheDocument();
      expect(screen.getByText('Dark')).toBeInTheDocument();
      expect(screen.getByText('System')).toBeInTheDocument();
      
      expect(screen.getByText('Clean and bright interface')).toBeInTheDocument();
      expect(screen.getByText('Easy on the eyes in low light')).toBeInTheDocument();
      expect(screen.getByText('Follow device settings')).toBeInTheDocument();
    });
  });
  
  describe('TC-002: User can select between Light, Dark, and System theme options', () => {
    it('should show light theme as selected by default', () => {
      render(<ThemeSettingsWithProvider themeValue="light" />);
      
      const lightOption = screen.getByRole('radio', { name: /light/i });
      expect(lightOption).toHaveAttribute('aria-checked', 'true');
      expect(lightOption.closest('.theme-option')).toHaveClass('theme-option--active');
    });
    
    it('should allow selecting dark theme', async () => {
      const user = userEvent.setup();
      render(<ThemeSettingsWithProvider />);
      
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      await user.click(darkOption);
      
      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });
    
    it('should allow selecting system theme', async () => {
      const user = userEvent.setup();
      render(<ThemeSettingsWithProvider />);
      
      const systemOption = screen.getByRole('radio', { name: /system/i });
      await user.click(systemOption);
      
      expect(mockSetTheme).toHaveBeenCalledWith('system');
    });
    
    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<ThemeSettingsWithProvider />);
      
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      darkOption.focus();
      
      await user.keyboard('{Enter}');
      expect(mockSetTheme).toHaveBeenCalledWith('dark');
      
      await user.keyboard('{Space}');
      expect(mockSetTheme).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('TC-005: Theme changes apply immediately without requiring app restart', () => {
    it('should update UI state immediately when theme is changed', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<ThemeSettingsWithProvider themeValue="light" />);
      
      // Initially light theme should be active
      expect(screen.getByRole('radio', { name: /light/i })).toHaveAttribute('aria-checked', 'true');
      
      // Click dark theme
      await user.click(screen.getByRole('radio', { name: /dark/i }));
      expect(mockSetTheme).toHaveBeenCalledWith('dark');
      
      // Rerender with dark theme selected
      rerender(<ThemeSettingsWithProvider themeValue="dark" />);
      
      // Dark theme should now be active
      expect(screen.getByRole('radio', { name: /dark/i })).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('radio', { name: /dark/i }).closest('.theme-option')).toHaveClass('theme-option--active');
    });
  });
  
  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<ThemeSettingsWithProvider />);
      
      const themeOptions = screen.getAllByRole('radio');
      themeOptions.forEach(option => {
        expect(option).toHaveAttribute('aria-checked');
        expect(option).toHaveAttribute('tabIndex');
      });
    });
    
    it('should support screen readers with proper labels', () => {
      render(<ThemeSettingsWithProvider />);
      
      expect(screen.getByRole('radio', { name: /light/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /dark/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /system/i })).toBeInTheDocument();
    });
    
    it('should be focusable and keyboard navigable', () => {
      render(<ThemeSettingsWithProvider />);
      
      const themeOptions = screen.getAllByRole('radio');
      themeOptions.forEach(option => {
        expect(option).toHaveAttribute('tabIndex', '0');
      });
    });
  });
  
  describe('Visual indicators', () => {
    it('should display theme icons', () => {
      render(<ThemeSettingsWithProvider />);
      
      expect(screen.getByText('☀️')).toBeInTheDocument(); // Light theme icon
      expect(screen.getByText('🌙')).toBeInTheDocument(); // Dark theme icon
      expect(screen.getByText('⚙️')).toBeInTheDocument(); // System theme icon
    });
    
    it('should apply active styling to selected theme', () => {
      render(<ThemeSettingsWithProvider themeValue="dark" />);
      
      const darkOption = screen.getByRole('radio', { name: /dark/i }).closest('.theme-option');
      expect(darkOption).toHaveClass('theme-option--active');
      
      const lightOption = screen.getByRole('radio', { name: /light/i }).closest('.theme-option');
      expect(lightOption).not.toHaveClass('theme-option--active');
    });
  });
  
  describe('Edge cases', () => {
    it('should handle rapid theme switching', async () => {
      const user = userEvent.setup();
      render(<ThemeSettingsWithProvider />);
      
      // Rapidly switch between themes
      await user.click(screen.getByRole('radio', { name: /dark/i }));
      await user.click(screen.getByRole('radio', { name: /system/i }));
      await user.click(screen.getByRole('radio', { name: /light/i }));
      
      expect(mockSetTheme).toHaveBeenCalledTimes(3);
      expect(mockSetTheme).toHaveBeenNthCalledWith(1, 'dark');
      expect(mockSetTheme).toHaveBeenNthCalledWith(2, 'system');
      expect(mockSetTheme).toHaveBeenNthCalledWith(3, 'light');
    });
    
    it('should prevent default behavior on space/enter key press', async () => {
      const user = userEvent.setup();
      render(<ThemeSettingsWithProvider />);
      
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      darkOption.focus();
      
      const preventDefault = jest.fn();
      fireEvent.keyDown(darkOption, { 
        key: 'Enter', 
        preventDefault 
      });
      
      await waitFor(() => {
        expect(preventDefault).toHaveBeenCalled();
      });
    });
  });
});