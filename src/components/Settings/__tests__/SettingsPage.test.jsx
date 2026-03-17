import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../contexts/ThemeContext';
import SettingsPage from '../SettingsPage';

// Mock localStorage
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: query.includes('dark') ? false : true,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

const renderSettingsPage = () => {
  return render(
    <ThemeProvider>
      <SettingsPage />
    </ThemeProvider>
  );
};

describe('SettingsPage', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    jest.clearAllMocks();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.className = '';
  });

  describe('TC-001: Settings page includes theme toggle option', () => {
    it('should display settings page with theme section', () => {
      renderSettingsPage();
      
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Appearance')).toBeInTheDocument();
      expect(screen.getByText('Theme')).toBeInTheDocument();
    });

    it('should display Light and Dark theme options', () => {
      renderSettingsPage();
      
      expect(screen.getByText('Light')).toBeInTheDocument();
      expect(screen.getByText('Dark')).toBeInTheDocument();
      expect(screen.getByText('System')).toBeInTheDocument();
    });

    it('should show theme options as radio buttons with proper ARIA attributes', () => {
      renderSettingsPage();
      
      const themeGroup = screen.getByRole('radiogroup');
      expect(themeGroup).toBeInTheDocument();
      
      const lightOption = screen.getByRole('radio', { name: /light/i });
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      const systemOption = screen.getByRole('radio', { name: /system/i });
      
      expect(lightOption).toBeInTheDocument();
      expect(darkOption).toBeInTheDocument();
      expect(systemOption).toBeInTheDocument();
    });
  });

  describe('TC-004: Theme change takes effect immediately', () => {
    it('should change theme immediately when option is selected', async () => {
      renderSettingsPage();
      
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      
      fireEvent.click(darkOption);
      
      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      });
    });

    it('should update selected state immediately', async () => {
      renderSettingsPage();
      
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      const lightOption = screen.getByRole('radio', { name: /light/i });
      
      // Initially system should be selected
      const systemOption = screen.getByRole('radio', { name: /system/i });
      expect(systemOption).toHaveAttribute('aria-checked', 'true');
      
      fireEvent.click(darkOption);
      
      await waitFor(() => {
        expect(darkOption).toHaveAttribute('aria-checked', 'true');
        expect(lightOption).toHaveAttribute('aria-checked', 'false');
        expect(systemOption).toHaveAttribute('aria-checked', 'false');
      });
    });
  });

  describe('TC-006: Keyboard navigation accessibility', () => {
    it('should be accessible via keyboard navigation', async () => {
      const user = userEvent.setup();
      renderSettingsPage();
      
      const lightOption = screen.getByRole('radio', { name: /light/i });
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      
      // Focus on light option
      lightOption.focus();
      expect(lightOption).toHaveFocus();
      
      // Press Enter to select
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(lightOption).toHaveAttribute('aria-checked', 'true');
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      });
    });

    it('should support Space key for theme selection', async () => {
      const user = userEvent.setup();
      renderSettingsPage();
      
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      
      darkOption.focus();
      await user.keyboard(' ');
      
      await waitFor(() => {
        expect(darkOption).toHaveAttribute('aria-checked', 'true');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      });
    });

    it('should have proper tab order for theme options', () => {
      renderSettingsPage();
      
      const lightOption = screen.getByRole('radio', { name: /light/i });
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      const systemOption = screen.getByRole('radio', { name: /system/i });
      
      expect(lightOption).toHaveAttribute('tabIndex');
      expect(darkOption).toHaveAttribute('tabIndex');
      expect(systemOption).toHaveAttribute('tabIndex');
    });
  });

  describe('TC-002: Theme persistence', () => {
    it('should save theme selection to localStorage', async () => {
      renderSettingsPage();
      
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      
      fireEvent.click(darkOption);
      
      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
      });
    });

    it('should restore saved theme on page load', async () => {
      mockLocalStorage.setItem('theme', 'dark');
      
      renderSettingsPage();
      
      await waitFor(() => {
        const darkOption = screen.getByRole('radio', { name: /dark/i });
        expect(darkOption).toHaveAttribute('aria-checked', 'true');
      });
    });
  });

  describe('Theme option descriptions', () => {
    it('should display helpful descriptions for theme options', () => {
      renderSettingsPage();
      
      expect(screen.getByText(/Select your preferred theme/i)).toBeInTheDocument();
      expect(screen.getByText(/System will use your device's theme setting/i)).toBeInTheDocument();
    });
  });

  describe('Form interactions', () => {
    it('should prevent default behavior on keyboard events', async () => {
      renderSettingsPage();
      
      const lightOption = screen.getByRole('radio', { name: /light/i });
      
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true
      });
      
      const preventDefaultSpy = jest.spyOn(enterEvent, 'preventDefault');
      
      lightOption.dispatchEvent(enterEvent);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });
});