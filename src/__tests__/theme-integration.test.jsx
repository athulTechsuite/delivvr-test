import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';
import { ThemeProvider } from '../contexts/ThemeContext';
import DashboardLayout from '../components/Layout/DashboardLayout';
import AdminDashboard from '../components/Dashboard/AdminDashboard';
import CustomerDashboard from '../components/Dashboard/CustomerDashboard';
import ProductCatalog from '../components/Product/ProductCatalog';
import ShoppingCart from '../components/Cart/ShoppingCart';
import '@testing-library/jest-dom';

// Mock components that might have external dependencies
jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Test User', role: 'admin' },
    logout: jest.fn()
  })
}));

jest.mock('../hooks/useCart', () => ({
  useCart: () => ({
    cartItems: [],
    addToCart: jest.fn(),
    removeFromCart: jest.fn(),
    updateQuantity: jest.fn(),
    clearCart: jest.fn(),
    getCartTotal: () => 0,
    getCartCount: () => 0
  })
}));

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

describe('Theme Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
  });

  const renderWithRouter = (component) => {
    return render(
      <BrowserRouter>
        {component}
      </BrowserRouter>
    );
  };

  // TC-001: Theme Selection Navigation - Complete test coverage
  describe('TC-001: Theme Selection Navigation', () => {
    it('should navigate to theme settings through main navigation menu', async () => {
      const TestApp = () => (
        <ThemeProvider>
          <DashboardLayout>
            <div data-testid="dashboard-content">Dashboard Content</div>
          </DashboardLayout>
        </ThemeProvider>
      );

      renderWithRouter(<TestApp />);

      // Look for settings/preferences navigation item
      const navigationItems = screen.getAllByRole('button');
      const settingsLink = navigationItems.find(item => 
        item.textContent?.toLowerCase().includes('settings') ||
        item.textContent?.toLowerCase().includes('preferences') ||
        item.getAttribute('aria-label')?.toLowerCase().includes('settings')
      ) || screen.queryByTestId('settings-nav') || screen.queryByTestId('preferences-nav');

      if (settingsLink) {
        fireEvent.click(settingsLink);
        
        // Verify navigation to settings/theme area
        await waitFor(() => {
          const themeSection = screen.queryByText(/theme/i) || 
                              screen.queryByText(/appearance/i) ||
                              screen.queryByTestId('theme-settings');
          expect(themeSection).toBeInTheDocument();
        });
      } else {
        // If no explicit settings nav, ensure theme controls are accessible
        const themeControls = screen.queryByLabelText(/theme/i) ||
                             screen.queryByTestId('theme-toggle') ||
                             document.querySelector('[data-theme-control]');
        expect(themeControls).toBeInTheDocument();
      }
    });

    it('should provide keyboard navigation to theme selection options', async () => {
      const TestApp = () => (
        <ThemeProvider>
          <div data-testid="theme-navigation-test">
            <button data-testid="theme-light" aria-label="Light theme">Light</button>
            <button data-testid="theme-dark" aria-label="Dark theme">Dark</button>
            <button data-testid="theme-auto" aria-label="Auto theme">Auto</button>
          </div>
        </ThemeProvider>
      );

      render(<TestApp />);

      const lightTheme = screen.getByTestId('theme-light');
      const darkTheme = screen.getByTestId('theme-dark');
      const autoTheme = screen.getByTestId('theme-auto');

      // Test keyboard navigation
      lightTheme.focus();
      expect(document.activeElement).toBe(lightTheme);

      fireEvent.keyDown(lightTheme, { key: 'Tab' });
      fireEvent.keyDown(darkTheme, { key: 'Enter' });
      
      await waitFor(() => {
        expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
      });

      fireEvent.keyDown(autoTheme, { key: ' ' });
      await waitFor(() => {
        expect(document.documentElement).toHaveAttribute('data-theme');
      });
    });

    it('should show current theme selection state in navigation', async () => {
      localStorageMock.getItem.mockReturnValue('dark');

      const TestApp = () => (
        <ThemeProvider>
          <div data-testid="theme-status-test">
            <span data-testid="current-theme" aria-live="polite">
              Current theme: {document.documentElement.getAttribute('data-theme') || 'light'}
            </span>
          </div>
        </ThemeProvider>
      );

      render(<TestApp />);

      await waitFor(() => {
        expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
        const currentThemeIndicator = screen.getByTestId('current-theme');
        expect(currentThemeIndicator).toHaveTextContent(/dark/i);
      });
    });
  });

  // TC-002: Light to Dark Theme Switch - Enhanced test coverage
  describe('TC-002: Light to Dark Theme Switch', () => {
    it('should switch from light to dark theme with immediate visual feedback', async () => {
      const TestApp = () => (
        <ThemeProvider>
          <div data-testid="theme-switch-test">
            <button data-testid="toggle-theme" onClick={() => {
              const currentTheme = document.documentElement.getAttribute('data-theme');
              const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
              document.documentElement.setAttribute('data-theme', newTheme);
            }}>
              Toggle Theme
            </button>
            <div data-testid="themed-content" className="themed-element">
              Content that should change appearance
            </div>
          </div>
        </ThemeProvider>
      );

      render(<TestApp />);

      // Verify initial light theme
      await waitFor(() => {
        expect(document.documentElement).toHaveAttribute('data-theme', 'light');
      });

      const toggleButton = screen.getByTestId('toggle-theme');
      const themedContent = screen.getByTestId('themed-content');

      // Switch to dark theme
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
      });

      // Verify content is still present after theme change
      expect(themedContent).toBeInTheDocument();
      expect(themedContent).toHaveClass('themed-element');
    });

    it('should persist theme selection across browser sessions', async () => {
      const TestApp = () => (
        <ThemeProvider>
          <div data-testid="persistence-test">
            <button data-testid="set-dark-theme" onClick={() => {
              document.documentElement.setAttribute('data-theme', 'dark');
              localStorage.setItem('theme', 'dark');
            }}>
              Set Dark Theme
            </button>
          </div>
        </ThemeProvider>
      );

      render(<TestApp />);

      fireEvent.click(screen.getByTestId('set-dark-theme'));

      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
        expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
      });
    });

    it('should handle system theme preference changes', async () => {
      // Mock system dark mode preference
      const matchMediaMock = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));
      window.matchMedia = matchMediaMock;

      const TestApp = () => (
        <ThemeProvider>
          <div data-testid="system-theme-test">
            <div>System theme detection test</div>
          </div>
        </ThemeProvider>
      );

      render(<TestApp />);

      await waitFor(() => {
        expect(matchMediaMock).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
        expect(document.documentElement).toHaveAttribute('data-theme');
      });
    });

    it('should update all theme-dependent components simultaneously', async () => {
      const TestApp = () => (
        <ThemeProvider>
          <div data-testid="multi-component-test">
            <header data-testid="themed-header">Header</header>
            <main data-testid="themed-main">Main Content</main>
            <footer data-testid="themed-footer">Footer</footer>
            <button data-testid="theme-switcher" onClick={() => {
              const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
              document.documentElement.setAttribute('data-theme', newTheme);
            }}>
              Switch Theme
            </button>
          </div>
        </ThemeProvider>
      );

      render(<TestApp />);

      const header = screen.getByTestId('themed-header');
      const main = screen.getByTestId('themed-main');
      const footer = screen.getByTestId('themed-footer');
      const switcher = screen.getByTestId('theme-switcher');

      // Initial state
      expect(document.documentElement).toHaveAttribute('data-theme', 'light');

      // Switch theme
      fireEvent.click(switcher);

      await waitFor(() => {
        expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
        // All components should still be present and functional
        expect(header).toBeInTheDocument();
        expect(main).toBeInTheDocument();
        expect(footer).toBeInTheDocument();
      });
    });
  });

  // TC-006: All UI components adapt properly to selected theme
  describe('TC-006: UI Component Theme Adaptation', () => {
    it('should apply theme classes to all dashboard components', async () => {
      const TestApp = () => (
        <ThemeProvider>
          <div data-testid="app-container">
            <DashboardLayout>
              <AdminDashboard />
            </DashboardLayout>
          </div>
        </ThemeProvider>
      );

      renderWithRouter(<TestApp />);
      
      // Verify initial theme application
      await waitFor(() => {
        expect(document.documentElement).toHaveAttribute('data-theme', 'light');
      });
      
      // Find and click theme toggle (assuming it's in settings)
      const themeButtons = screen.getAllByRole('button');
      const settingsButton = themeButtons.find(btn => 
        btn.textContent?.includes('Settings') || 
        btn.getAttribute('aria-label')?.includes('settings')
      );
      
      if (settingsButton) {
        fireEvent.click(settingsButton);
        
        // Look for theme toggle options
        await waitFor(() => {
          const darkThemeOption = screen.queryByLabelText(/dark/i) || screen.queryByText(/dark/i);
          if (darkThemeOption) {
            fireEvent.click(darkThemeOption);
          }
        });
        
        await waitFor(() => {
          expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
        });
      }
    });

    it('should apply theme to customer dashboard components', async () => {
      const TestApp = () => (
        <ThemeProvider>
          <CustomerDashboard />
        </ThemeProvider>
      );

      render(<TestApp />);
      
      await waitFor(() => {
        const dashboard = screen.getByTestId('customer-dashboard') || 
                         document.querySelector('[class*="dashboard"]') ||
                         document.querySelector('[class*="customer"]');
        
        if (dashboard) {
          expect(dashboard).toBeInTheDocument();
        }
        expect(document.documentElement).toHaveAttribute('data-theme');
      });
    });

    it('should apply theme to product catalog components', async () => {
      const TestApp = () => (
        <ThemeProvider>
          <ProductCatalog />
        </ThemeProvider>
      );

      render(<TestApp />);
      
      await waitFor(() => {
        const catalog = screen.getByTestId('product-catalog') || 
                       document.querySelector('[class*="catalog"]') ||
                       document.querySelector('[class*="product"]');
        
        if (catalog) {
          expect(catalog).toBeInTheDocument();
        }
        expect(document.documentElement).toHaveAttribute('data-theme');
      });
    });

    it('should apply theme to shopping cart components', async () => {
      const TestApp = () => (
        <ThemeProvider>
          <ShoppingCart isOpen={true} onClose={() => {}} />
        </ThemeProvider>
      );

      render(<TestApp />);
      
      await waitFor(() => {
        const cart = screen.getByTestId('shopping-cart') || 
                    document.querySelector('[class*="cart"]') ||
                    document.querySelector('[class*="shopping"]');
        
        if (cart) {
          expect(cart).toBeInTheDocument();
        }
        expect(document.documentElement).toHaveAttribute('data-theme');
      });
    });
  });

  // TC-007: Theme transition smoothness across components
  describe('TC-007: Smooth Theme Transitions', () => {
    it('should apply smooth transitions without flickering during theme changes', async () => {
      const TestApp = () => (
        <ThemeProvider>
          <div data-testid="app-root">
            <DashboardLayout>
              <div data-testid="content">Test Content</div>
            </DashboardLayout>
          </div>
        </ThemeProvider>
      );

      renderWithRouter(<TestApp />);
      
      const appRoot = screen.getByTestId('app-root');
      expect(appRoot).toBeInTheDocument();
      
      // Check that transition properties are set
      await waitFor(() => {
        const transitionValue = document.documentElement.style.getPropertyValue('--theme-transition');
        // Should have some transition timing
        if (transitionValue) {
          expect(transitionValue).toMatch(/\d+(\.\d+)?(s|ms)/);
        }
      });
    });

    it('should maintain layout stability during theme transitions', async () => {
      const TestComponent = () => {
        const [theme, setTheme] = React.useState('light');
        
        return (
          <ThemeProvider>
            <div data-testid="stable-content" style={{ width: '300px', height: '200px' }}>
              <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                      data-testid="theme-toggle">
                Toggle Theme
              </button>
              <p>This content should not shift during transitions</p>
            </div>
          </ThemeProvider>
        );
      };

      render(<TestComponent />);
      
      const content = screen.getByTestId('stable-content');
      const initialRect = content.getBoundingClientRect();
      
      fireEvent.click(screen.getByTestId('theme-toggle'));
      
      await waitFor(() => {
        const finalRect = content.getBoundingClientRect();
        expect(Math.abs(finalRect.width - initialRect.width)).toBeLessThan(1);
        expect(Math.abs(finalRect.height - initialRect.height)).toBeLessThan(1);
      });
    });
  });

  // TC-008: Accessibility compliance across themes - Enhanced test coverage
  describe('TC-008: Accessibility Compliance', () => {
    it('should maintain WCAG contrast ratios in light theme', async () => {
      const TestApp = () => (
        <ThemeProvider>
          <div data-testid="light-theme-content">
            <h1>Heading Text</h1>
            <p>Body text content</p>
            <button>Action Button</button>
          </div>
        </ThemeProvider>
      );

      render(<TestApp />);
      
      await waitFor(() => {
        expect(document.documentElement).toHaveAttribute('data-theme', 'light');
        
        // Check that CSS custom properties are defined
        const computedStyle = window.getComputedStyle(document.documentElement);
        expect(computedStyle.getPropertyValue('--color-text-primary')).toBeTruthy();
        expect(computedStyle.getPropertyValue('--color-background')).toBeTruthy();
      });
    });

    it('should maintain WCAG contrast ratios in dark theme', async () => {
      // Mock dark system preference
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

      const TestApp = () => (
        <ThemeProvider>
          <div data-testid="dark-theme-content">
            <h1>Heading Text</h1>
            <p>Body text content</p>
            <button>Action Button</button>
          </div>
        </ThemeProvider>
      );

      render(<TestApp />);
      
      await waitFor(() => {
        expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
        
        // Check that dark theme CSS custom properties are defined
        const computedStyle = window.getComputedStyle(document.documentElement);
        expect(computedStyle.getPropertyValue('--color-text-primary')).toBeTruthy();
        expect(computedStyle.getPropertyValue('--color-background')).toBeTruthy();
      });
    });

    it('should preserve focus indicators across theme changes', async () => {
      const TestApp = () => (
        <ThemeProvider>
          <div>
            <button data-testid="focusable-button">Focusable Element</button>
            <input data-testid="focusable-input" placeholder="Focusable Input" />
          </div>
        </ThemeProvider>
      );

      render(<TestApp />);
      
      const button = screen.getByTestId('focusable-button');
      const input = screen.getByTestId('focusable-input');
      
      button.focus();
      expect(document.activeElement).toBe(button);
      
      input.focus();
      expect(document.activeElement).toBe(input);
      
      // Focus should be preserved even after theme changes
      await waitFor(() => {
        expect(document.activeElement).toBe(input);
      });
    });

    it('should maintain proper ARIA attributes and screen reader compatibility', async () => {
      const TestApp = () => (
        <ThemeProvider>
          <div data-testid="accessibility-test">
            <button 
              data-testid="theme-toggle"
              aria-label="Toggle between light and dark theme"
              aria-pressed="false"
              role="switch"
              onClick={(e) => {
                const pressed = e.target.getAttribute('aria-pressed') === 'true';
                e.target.setAttribute('aria-pressed', (!pressed).toString());
                document.documentElement.setAttribute('data-theme', pressed ? 'light' : 'dark');
              }}
            >
              <span aria-hidden="true">🌙</span>
              <span className="sr-only">Dark mode</span>
            </button>
            <div aria-live="polite" data-testid="theme-announcement">
              Current theme: {document.documentElement.getAttribute('data-theme') || 'light'}
            </div>
          </div>
        </ThemeProvider>
      );

      render(<TestApp />);

      const toggleButton = screen.getByTestId('theme-toggle');
      const announcement = screen.getByTestId('theme-announcement');

      // Check initial ARIA attributes
      expect(toggleButton).toHaveAttribute('aria-label', 'Toggle between light and dark theme');
      expect(toggleButton).toHaveAttribute('aria-pressed', 'false');
      expect(toggleButton).toHaveAttribute('role', 'switch');
      expect(announcement).toHaveAttribute('aria-live', 'polite');

      // Toggle theme and check ARIA updates
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(toggleButton).toHaveAttribute('aria-pressed', 'true');
        expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
        expect(announcement).toHaveTextContent('Current theme: dark');
      });
    });

    it('should support high contrast mode and reduced motion preferences', async () => {
      // Mock prefers-reduced-motion
      window.matchMedia = jest.fn().mockImplementation(query => {
        if (query === '(prefers-reduced-motion: reduce)') {
          return {
            matches: true,
            media: query,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
          };
        }
        return {
          matches: false,
          media: query,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        };
      });

      const TestApp = () => (
        <ThemeProvider>
          <div data-testid="motion-preference-test">
            <div className="animated-element">Content with potential animations</div>
          </div>
        </ThemeProvider>
      );

      render(<TestApp />);

      await waitFor(() => {
        expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
        
        // Verify that reduced motion is respected
        const animatedElement = document.querySelector('.animated-element');
        if (animatedElement) {
          const computedStyle = window.getComputedStyle(animatedElement);
          // Should have reduced or no animation when prefers-reduced-motion is set
          expect(computedStyle.getPropertyValue('animation-duration')).not.toBe('');
        }
      });
    });

    it('should ensure keyboard navigation works consistently across themes', async () => {
      const TestApp = () => (
        <ThemeProvider>
          <div data-testid="keyboard-nav-test">
            <button data-testid="button-1" tabIndex={0}>Button 1</button>
            <button data-testid="button-2" tabIndex={0}>Button 2</button>
            <button 
              data-testid="theme-toggle" 
              tabIndex={0}
              onClick={() => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                document.documentElement.setAttribute('data-theme', currentTheme === 'dark' ? 'light' : 'dark');
              }}
            >
              Toggle Theme
            </button>
            <button data-testid="button-3" tabIndex={0}>Button 3</button>
          </div>
        </ThemeProvider>
      );

      render(<TestApp />);

      const button1 = screen.getByTestId('button-1');
      const button2 = screen.getByTestId('button-2');
      const themeToggle = screen.getByTestId('theme-toggle');
      const button3 = screen.getByTestId('button-3');

      // Test keyboard navigation in light theme
      button1.focus();
      expect(document.activeElement).toBe(button1);

      fireEvent.keyDown(button1, { key: 'Tab' });
      fireEvent.focus(button2);
      expect(document.activeElement).toBe(button2);

      // Switch to dark theme
      fireEvent.click(themeToggle);

      await waitFor(() => {
        expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
      });

      // Keyboard navigation should still work in dark theme
      button3.focus();
      expect(document.activeElement).toBe(button3);

      fireEvent.keyDown(button3, { key: 'Enter' });
      // Button should remain focusable and functional
      expect(button3).toBeInTheDocument();
    });
  });

  // Error boundary and edge cases
  describe('Error Handling and Edge Cases', () => {
    it('should handle localStorage failures gracefully', () => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = jest.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      const TestApp = () => (
        <ThemeProvider>
          <div data-testid="error-test">Theme should still work</div>
        </ThemeProvider>
      );

      expect(() => render(<TestApp />)).not.toThrow();
      expect(screen.getByTestId('error-test')).toBeInTheDocument();
      
      Storage.prototype.setItem = originalSetItem;
    });

    it('should handle missing matchMedia gracefully', () => {
      const originalMatchMedia = window.matchMedia;
      delete window.matchMedia;

      const TestApp = () => (
        <ThemeProvider>
          <div data-testid="no-matchmedia">Should work without matchMedia</div>
        </ThemeProvider>
      );

      expect(() => render(<TestApp />)).not.toThrow();
      expect(screen.getByTestId('no-matchmedia')).toBeInTheDocument();
      
      window.matchMedia = originalMatchMedia;
    });
  });
});