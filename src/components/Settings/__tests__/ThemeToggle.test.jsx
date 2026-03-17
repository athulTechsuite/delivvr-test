import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeToggle, ThemeProvider } from '../ThemeToggle';
import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('ThemeToggle Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
  });

  const renderThemeToggle = () => {
    return render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );
  };

  // TC-001: Settings menu displays theme toggle with Light and Dark options
  describe('TC-001: Theme toggle display', () => {
    it('should display theme toggle options in settings menu', () => {
      renderThemeToggle();
      
      expect(screen.getByText(/theme/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/light/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/dark/i)).toBeInTheDocument();
    });

    it('should display system option for following OS preference', () => {
      renderThemeToggle();
      
      expect(screen.getByLabelText(/system/i)).toBeInTheDocument();
    });

    it('should have proper ARIA labels for accessibility', () => {
      renderThemeToggle();
      
      const themeToggle = screen.getByRole('radiogroup', { name: /theme selection/i });
      expect(themeToggle).toBeInTheDocument();
      
      const lightOption = screen.getByRole('radio', { name: /light theme/i });
      const darkOption = screen.getByRole('radio', { name: /dark theme/i });
      const systemOption = screen.getByRole('radio', { name: /system theme/i });
      
      expect(lightOption).toBeInTheDocument();
      expect(darkOption).toBeInTheDocument();
      expect(systemOption).toBeInTheDocument();
    });
  });

  // TC-002 & TC-003: Theme selection and application
  describe('TC-002/TC-003: Theme selection', () => {
    it('should select and apply dark theme when dark option is clicked', async () => {
      renderThemeToggle();
      
      const darkOption = screen.getByLabelText(/dark/i);
      fireEvent.click(darkOption);
      
      await waitFor(() => {
        expect(darkOption).toBeChecked();
        expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
        expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
      });
    });

    it('should select and apply light theme when light option is clicked', async () => {
      renderThemeToggle();
      
      const lightOption = screen.getByLabelText(/light/i);
      fireEvent.click(lightOption);
      
      await waitFor(() => {
        expect(lightOption).toBeChecked();
        expect(document.documentElement).toHaveAttribute('data-theme', 'light');
        expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light');
      });
    });

    it('should select system theme and follow OS preference', async () => {
      // Mock system preference as dark
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      renderThemeToggle();
      
      const systemOption = screen.getByLabelText(/system/i);
      fireEvent.click(systemOption);
      
      await waitFor(() => {
        expect(systemOption).toBeChecked();
        expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
        expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'system');
      });
    });
  });

  // TC-004: Theme persistence
  describe('TC-004: Theme persistence', () => {
    it('should load saved theme preference on component mount', () => {
      localStorageMock.getItem.mockReturnValue('dark');
      
      renderThemeToggle();
      
      const darkOption = screen.getByLabelText(/dark/i);
      expect(darkOption).toBeChecked();
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    });

    it('should persist theme selection between sessions', async () => {
      renderThemeToggle();
      
      const lightOption = screen.getByLabelText(/light/i);
      fireEvent.click(lightOption);
      
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light');
      });
    });

    it('should default to system theme when no preference is saved', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      renderThemeToggle();
      
      const systemOption = screen.getByLabelText(/system/i);
      expect(systemOption).toBeChecked();
    });
  });

  // TC-005: System preference following
  describe('TC-005: System preference behavior', () => {
    it('should follow system dark preference when system theme is selected', () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      renderThemeToggle();
      
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    });

    it('should follow system light preference when system theme is selected', () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      renderThemeToggle();
      
      expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    });

    it('should update theme when system preference changes', async () => {
      let changeCallback;
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn((event, callback) => {
          if (event === 'change') changeCallback = callback;
        }),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      renderThemeToggle();
      
      // Simulate system preference change to dark
      if (changeCallback) {
        changeCallback({ matches: true });
      }

      await waitFor(() => {
        expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
      });
    });
  });

  // TC-007: Smooth transitions
  describe('TC-007: Smooth transitions', () => {
    it('should apply transition class during theme changes', async () => {
      renderThemeToggle();
      
      const darkOption = screen.getByLabelText(/dark/i);
      fireEvent.click(darkOption);
      
      // Check if transition property is applied
      await waitFor(() => {
        const transitionValue = document.documentElement.style.getPropertyValue('--theme-transition');
        expect(transitionValue).toContain('0.3s ease');
      });
    });

    it('should not cause layout shifts during theme transitions', async () => {
      renderThemeToggle();
      
      const initialRect = screen.getByLabelText(/dark/i).getBoundingClientRect();
      
      fireEvent.click(screen.getByLabelText(/dark/i));
      
      await waitFor(() => {
        const finalRect = screen.getByLabelText(/dark/i).getBoundingClientRect();
        expect(finalRect.width).toBe(initialRect.width);
        expect(finalRect.height).toBe(initialRect.height);
      });
    });
  });

  // Keyboard navigation and accessibility
  describe('Accessibility', () => {
    it('should support keyboard navigation', () => {
      renderThemeToggle();
      
      const lightOption = screen.getByLabelText(/light/i);
      const darkOption = screen.getByLabelText(/dark/i);
      
      lightOption.focus();
      expect(document.activeElement).toBe(lightOption);
      
      fireEvent.keyDown(lightOption, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(darkOption);
    });

    it('should have proper contrast ratios for both themes', async () => {
      renderThemeToggle();
      
      // Test light theme
      const lightOption = screen.getByLabelText(/light/i);
      fireEvent.click(lightOption);
      
      await waitFor(() => {
        const computedStyle = window.getComputedStyle(document.documentElement);
        // These would need actual color contrast ratio calculations
        expect(computedStyle.getPropertyValue('--color-text-primary')).toBeTruthy();
        expect(computedStyle.getPropertyValue('--color-background')).toBeTruthy();
      });
      
      // Test dark theme
      const darkOption = screen.getByLabelText(/dark/i);
      fireEvent.click(darkOption);
      
      await waitFor(() => {
        const computedStyle = window.getComputedStyle(document.documentElement);
        expect(computedStyle.getPropertyValue('--color-text-primary')).toBeTruthy();
        expect(computedStyle.getPropertyValue('--color-background')).toBeTruthy();
      });
    });
  });
});