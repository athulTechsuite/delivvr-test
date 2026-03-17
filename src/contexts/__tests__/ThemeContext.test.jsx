import React, { act, renderHook } from '@testing-library/react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../ThemeContext';
import { THEMES, getSystemTheme } from '../../utils/themeUtils';

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

describe('ThemeContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
  });

  const renderWithThemeProvider = (children) => {
    return render(
      <ThemeProvider>{children}</ThemeProvider>
    );
  };

  // TC-001: Settings menu displays theme toggle with Light and Dark options
  describe('TC-001: Theme toggle options', () => {
    it('should provide theme context with light, dark, and system options', () => {
      const TestComponent = () => {
        const { theme, resolvedTheme, changeTheme } = useTheme();
        return (
          <div>
            <div data-testid="current-theme">{theme}</div>
            <div data-testid="resolved-theme">{resolvedTheme}</div>
            <button onClick={() => changeTheme('light')} data-testid="light-btn">Light</button>
            <button onClick={() => changeTheme('dark')} data-testid="dark-btn">Dark</button>
            <button onClick={() => changeTheme('system')} data-testid="system-btn">System</button>
          </div>
        );
      };

      renderWithThemeProvider(<TestComponent />);
      
      expect(screen.getByTestId('light-btn')).toBeInTheDocument();
      expect(screen.getByTestId('dark-btn')).toBeInTheDocument();
      expect(screen.getByTestId('system-btn')).toBeInTheDocument();
    });
  });

  // TC-002: Selecting Dark theme applies dark color scheme
  describe('TC-002: Dark theme application', () => {
    it('should apply dark theme when selected', async () => {
      const TestComponent = () => {
        const { changeTheme, resolvedTheme } = useTheme();
        return (
          <div>
            <div data-testid="theme-indicator">{resolvedTheme}</div>
            <button onClick={() => changeTheme('dark')} data-testid="dark-btn">Dark</button>
          </div>
        );
      };

      renderWithThemeProvider(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('dark-btn'));
      
      await waitFor(() => {
        expect(screen.getByTestId('theme-indicator')).toHaveTextContent('dark');
        expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
        expect(document.documentElement).toHaveClass('dark');
      });
    });
  });

  // TC-003: Selecting Light theme applies light color scheme
  describe('TC-003: Light theme application', () => {
    it('should apply light theme when selected', async () => {
      const TestComponent = () => {
        const { changeTheme, resolvedTheme } = useTheme();
        return (
          <div>
            <div data-testid="theme-indicator">{resolvedTheme}</div>
            <button onClick={() => changeTheme('light')} data-testid="light-btn">Light</button>
          </div>
        );
      };

      renderWithThemeProvider(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('light-btn'));
      
      await waitFor(() => {
        expect(screen.getByTestId('theme-indicator')).toHaveTextContent('light');
        expect(document.documentElement).toHaveAttribute('data-theme', 'light');
        expect(document.documentElement).toHaveClass('light');
      });
    });
  });

  // TC-004: Theme preference persistence
  describe('TC-004: Theme persistence', () => {
    it('should save theme preference to localStorage', async () => {
      const TestComponent = () => {
        const { changeTheme } = useTheme();
        return (
          <button onClick={() => changeTheme('dark')} data-testid="dark-btn">Dark</button>
        );
      };

      renderWithThemeProvider(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('dark-btn'));
      
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
      });
    });

    it('should load saved theme preference on initialization', () => {
      localStorageMock.getItem.mockReturnValue('dark');
      
      const TestComponent = () => {
        const { theme, resolvedTheme } = useTheme();
        return (
          <div>
            <div data-testid="theme">{theme}</div>
            <div data-testid="resolved-theme">{resolvedTheme}</div>
          </div>
        );
      };

      renderWithThemeProvider(<TestComponent />);
      
      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark');
    });
  });

  // TC-005: System preference default behavior
  describe('TC-005: System preference following', () => {
    it('should follow system preference when no manual selection is made', () => {
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

      const TestComponent = () => {
        const { theme, resolvedTheme } = useTheme();
        return (
          <div>
            <div data-testid="theme">{theme}</div>
            <div data-testid="resolved-theme">{resolvedTheme}</div>
          </div>
        );
      };

      renderWithThemeProvider(<TestComponent />);
      
      expect(screen.getByTestId('theme')).toHaveTextContent('system');
      expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark');
    });

    it('should update when system preference changes', async () => {
      let mediaQueryCallback;
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn((event, callback) => {
          if (event === 'change') {
            mediaQueryCallback = callback;
          }
        }),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      const TestComponent = () => {
        const { resolvedTheme, changeTheme } = useTheme();
        return (
          <div>
            <div data-testid="resolved-theme">{resolvedTheme}</div>
            <button onClick={() => changeTheme('system')} data-testid="system-btn">System</button>
          </div>
        );
      };

      renderWithThemeProvider(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('system-btn'));
      
      // Simulate system theme change
      act(() => {
        if (mediaQueryCallback) {
          mediaQueryCallback({ matches: true });
        }
      });

      await waitFor(() => {
        expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
      });
    });
  });

  // TC-007: Smooth theme transition
  describe('TC-007: Smooth transitions', () => {
    it('should apply transition styles during theme change', async () => {
      const TestComponent = () => {
        const { changeTheme } = useTheme();
        return (
          <button onClick={() => changeTheme('dark')} data-testid="dark-btn">Dark</button>
        );
      };

      renderWithThemeProvider(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('dark-btn'));
      
      await waitFor(() => {
        expect(document.documentElement.style.getPropertyValue('--theme-transition'))
          .toBe('all 0.3s ease');
      });
    });
  });

  // Error handling
  describe('Error handling', () => {
    it('should throw error when useTheme is used outside ThemeProvider', () => {
      const TestComponent = () => {
        useTheme();
        return <div>Test</div>;
      };

      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();
      
      expect(() => render(<TestComponent />)).toThrow(
        'useTheme must be used within a ThemeProvider'
      );
      
      console.error = originalError;
    });

    it('should handle localStorage errors gracefully', () => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = jest.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      const TestComponent = () => {
        const { changeTheme } = useTheme();
        return (
          <button onClick={() => changeTheme('dark')} data-testid="dark-btn">Dark</button>
        );
      };

      renderWithThemeProvider(<TestComponent />);
      
      // Should not throw error
      expect(() => {
        fireEvent.click(screen.getByTestId('dark-btn'));
      }).not.toThrow();
      
      Storage.prototype.setItem = originalSetItem;
    });
  });
});