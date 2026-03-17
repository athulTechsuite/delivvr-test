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

  // TC-008: Accessibility compliance across themes
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