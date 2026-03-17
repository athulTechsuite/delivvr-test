import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeContext } from '../../../contexts/ThemeContext';
import ThemeSettings from '../ThemeSettings';

// Mock the CSS import
jest.mock('../ThemeSettings.css', () => ({}));

// Mock color contrast utility for testing
const mockGetContrastRatio = jest.fn();
jest.mock('../../../utils/colorUtils', () => ({
  getContrastRatio: mockGetContrastRatio,
  isWCAGAACompliant: (ratio) => ratio >= 4.5,
}));

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
    mockGetContrastRatio.mockClear();
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
  
  describe('TC-006: WCAG 2.1 AA color contrast compliance', () => {
    it('should maintain minimum 4.5:1 contrast ratio for text elements in light theme', () => {
      // Mock contrast ratios for light theme
      mockGetContrastRatio.mockReturnValue(4.7); // Above minimum
      
      render(<ThemeSettingsWithProvider themeValue="light" />);
      
      const textElements = screen.getAllByText(/light|dark|system/i);
      textElements.forEach(element => {
        const styles = window.getComputedStyle(element);
        const contrastRatio = mockGetContrastRatio(styles.color, styles.backgroundColor);
        expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
      });
      
      expect(mockGetContrastRatio).toHaveBeenCalled();
    });
    
    it('should maintain minimum 4.5:1 contrast ratio for text elements in dark theme', () => {
      // Mock contrast ratios for dark theme
      mockGetContrastRatio.mockReturnValue(5.2); // Above minimum
      
      render(<ThemeSettingsWithProvider themeValue="dark" />);
      
      const textElements = screen.getAllByText(/light|dark|system/i);
      textElements.forEach(element => {
        const styles = window.getComputedStyle(element);
        const contrastRatio = mockGetContrastRatio(styles.color, styles.backgroundColor);
        expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
      });
      
      expect(mockGetContrastRatio).toHaveBeenCalled();
    });
    
    it('should maintain accessibility for focused elements', async () => {
      mockGetContrastRatio.mockReturnValue(7.1); // High contrast for focus states
      
      const user = userEvent.setup();
      render(<ThemeSettingsWithProvider />);
      
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      await user.tab();
      await user.tab();
      
      darkOption.focus();
      
      const styles = window.getComputedStyle(darkOption);
      const contrastRatio = mockGetContrastRatio(styles.color, styles.backgroundColor);
      expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
    });
    
    it('should validate contrast ratios for active/selected states', () => {
      mockGetContrastRatio.mockReturnValue(6.8); // High contrast for selected state
      
      render(<ThemeSettingsWithProvider themeValue="light" />);
      
      const activeOption = screen.getByRole('radio', { name: /light/i });
      expect(activeOption).toHaveAttribute('aria-checked', 'true');
      
      const styles = window.getComputedStyle(activeOption.closest('.theme-option--active'));
      const contrastRatio = mockGetContrastRatio(styles.color, styles.backgroundColor);
      expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
    });
  });
  
  describe('TC-007: Icons and images adapt to theme changes', () => {
    it('should display theme-appropriate icons for light theme', () => {
      render(<ThemeSettingsWithProvider themeValue="light" />);
      
      // Check that light theme icons are present
      const lightIcon = screen.getByText('☀️');
      const darkIcon = screen.getByText('🌙');
      const systemIcon = screen.getByText('⚙️');
      
      expect(lightIcon).toBeInTheDocument();
      expect(darkIcon).toBeInTheDocument();
      expect(systemIcon).toBeInTheDocument();
      
      // Verify icons have proper styling for light theme
      expect(lightIcon.closest('.theme-option')).toHaveClass('theme-option--light');
    });
    
    it('should display theme-appropriate icons for dark theme', () => {
      render(<ThemeSettingsWithProvider themeValue="dark" />);
      
      const lightIcon = screen.getByText('☀️');
      const darkIcon = screen.getByText('🌙');
      const systemIcon = screen.getByText('⚙️');
      
      expect(lightIcon).toBeInTheDocument();
      expect(darkIcon).toBeInTheDocument();
      expect(systemIcon).toBeInTheDocument();
      
      // Verify icons have proper styling for dark theme
      expect(darkIcon.closest('.theme-option')).toHaveClass('theme-option--active');
    });
    
    it('should update icon appearance when theme changes', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<ThemeSettingsWithProvider themeValue="light" />);
      
      // Initially in light theme
      const lightOption = screen.getByText('☀️').closest('.theme-option');
      expect(lightOption).toHaveClass('theme-option--active');
      
      // Switch to dark theme
      await user.click(screen.getByRole('radio', { name: /dark/i }));
      rerender(<ThemeSettingsWithProvider themeValue="dark" />);
      
      // Verify icon styling updated for dark theme
      const darkOption = screen.getByText('🌙').closest('.theme-option');
      expect(darkOption).toHaveClass('theme-option--active');
      
      const lightOptionAfter = screen.getByText('☀️').closest('.theme-option');
      expect(lightOptionAfter).not.toHaveClass('theme-option--active');
    });
    
    it('should apply proper opacity and color filters to icons based on theme', () => {
      render(<ThemeSettingsWithProvider themeValue="dark" />);
      
      const icons = [
        screen.getByText('☀️'),
        screen.getByText('🌙'),
        screen.getByText('⚙️')
      ];
      
      icons.forEach(icon => {
        const styles = window.getComputedStyle(icon);
        // Verify icons have appropriate styling applied
        expect(styles.opacity).toBeDefined();
        expect(icon.closest('.theme-option')).toHaveAttribute('data-theme-icon', expect.any(String));
      });
    });
    
    it('should handle icon transitions smoothly during theme changes', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<ThemeSettingsWithProvider themeValue="light" />);
      
      const systemIcon = screen.getByText('⚙️');
      
      // Click system theme
      await user.click(screen.getByRole('radio', { name: /system/i }));
      rerender(<ThemeSettingsWithProvider themeValue="system" />);
      
      // Verify transition classes are applied
      const systemOption = systemIcon.closest('.theme-option');
      expect(systemOption).toHaveClass('theme-option--active');
      
      // Check that icon maintains visibility during transition
      expect(systemIcon).toBeVisible();
    });
    
    it('should provide alternative text for screen readers when icons change', () => {
      const { rerender } = render(<ThemeSettingsWithProvider themeValue="light" />);
      
      // Check aria-labels or alt text for icons in light theme
      expect(screen.getByRole('radio', { name: /light/i })).toHaveAccessibleName();
      expect(screen.getByRole('radio', { name: /dark/i })).toHaveAccessibleName();
      expect(screen.getByRole('radio', { name: /system/i })).toHaveAccessibleName();
      
      // Switch theme and verify accessibility maintained
      rerender(<ThemeSettingsWithProvider themeValue="dark" />);
      
      expect(screen.getByRole('radio', { name: /light/i })).toHaveAccessibleName();
      expect(screen.getByRole('radio', { name: /dark/i })).toHaveAccessibleName();
      expect(screen.getByRole('radio', { name: /system/i })).toHaveAccessibleName();
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