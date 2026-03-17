import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { ThemeProvider, useTheme } from '../ThemeContext';

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

// Test component that uses the theme context
const TestComponent = () => {
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  return (
    <div>
      <div data-testid="theme">{theme}</div>
      <div data-testid="resolved-theme">{resolvedTheme}</div>
      <button data-testid="toggle-theme" onClick={toggleTheme}>
        Toggle Theme
      </button>
    </div>
  );
};

const renderWithThemeProvider = (component) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('ThemeContext', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    jest.clearAllMocks();
    // Reset document attributes
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.className = '';
  });

  describe('TC-006: System theme preference detection', () => {
    it('should detect and use system dark theme preference on first launch', async () => {
      // Mock system dark theme preference
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query.includes('dark') ? true : false,
        media: query,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));

      renderWithThemeProvider(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('system');
        expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark');
      });
    });

    it('should detect and use system light theme preference on first launch', async () => {
      // Mock system light theme preference
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query.includes('dark') ? false : true,
        media: query,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));

      renderWithThemeProvider(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('system');
        expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light');
      });
    });
  });

  describe('TC-002: Theme selection persistence', () => {
    it('should persist theme selection in localStorage', async () => {
      renderWithThemeProvider(<TestComponent />);

      const toggleButton = screen.getByTestId('toggle-theme');
      
      act(() => {
        fireEvent.click(toggleButton);
      });

      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', expect.any(String));
      });
    });

    it('should restore theme from localStorage on app restart', async () => {
      mockLocalStorage.setItem('theme', 'dark');

      renderWithThemeProvider(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('dark');
        expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark');
      });
    });

    it('should handle invalid theme values in localStorage gracefully', async () => {
      mockLocalStorage.setItem('theme', 'invalid-theme');

      renderWithThemeProvider(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('system');
      });
    });
  });

  describe('TC-004: Immediate theme application', () => {
    it('should apply theme changes immediately without page refresh', async () => {
      renderWithThemeProvider(<TestComponent />);

      const toggleButton = screen.getByTestId('toggle-theme');
      
      // Initial state should be system/light
      expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light');
      
      act(() => {
        fireEvent.click(toggleButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark');
      });
    });

    it('should update document attributes when theme changes', async () => {
      renderWithThemeProvider(<TestComponent />);

      const toggleButton = screen.getByTestId('toggle-theme');
      
      act(() => {
        fireEvent.click(toggleButton);
      });

      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(document.documentElement.className).toContain('theme-dark');
      });
    });
  });

  describe('Error handling', () => {
    it('should throw error when useTheme is used outside ThemeProvider', () => {
      // Spy on console.error to suppress error output in test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestComponent />);
      }).toThrow('useTheme must be used within a ThemeProvider');
      
      consoleSpy.mockRestore();
    });
  });

  describe('System theme change detection', () => {
    it('should respond to system theme changes when using system theme', async () => {
      let mediaQueryListener = null;
      
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query.includes('dark') ? false : true,
        media: query,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn((event, listener) => {
          if (event === 'change') {
            mediaQueryListener = listener;
          }
        }),
        removeEventListener: jest.fn(),
      }));

      renderWithThemeProvider(<TestComponent />);

      // Initially should be light
      await waitFor(() => {
        expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light');
      });

      // Simulate system theme change to dark
      if (mediaQueryListener) {
        act(() => {
          mediaQueryListener({ matches: true });
        });
      }

      await waitFor(() => {
        expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark');
      });
    });
  });
});

describe('Theme CSS Variables', () => {
  beforeEach(() => {
    document.documentElement.style.cssText = '';
  });

  it('should set CSS custom properties for dark theme', async () => {
    renderWithThemeProvider(<TestComponent />);
    
    const toggleButton = screen.getByTestId('toggle-theme');
    
    act(() => {
      fireEvent.click(toggleButton); // Toggle to dark
    });

    await waitFor(() => {
      const rootStyle = document.documentElement.style;
      expect(rootStyle.getPropertyValue('--bg-primary')).toBe('#1a1a1a');
      expect(rootStyle.getPropertyValue('--text-primary')).toBe('#ffffff');
    });
  });
});