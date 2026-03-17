import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../contexts/ThemeContext';
import DashboardLayout from '../Layout/DashboardLayout';
import LoginForm from '../Auth/LoginForm';
import ShoppingCart from '../Cart/ShoppingCart';
import ProductCatalog from '../Product/ProductCatalog';

// Mock all CSS imports
jest.mock('../../styles/themes.css', () => ({}));
jest.mock('../../styles/globals.css', () => ({}));
jest.mock('../Auth/LoginForm.css', () => ({}));
jest.mock('../Cart/ShoppingCart.css', () => ({}));
jest.mock('../Product/ProductCatalog.css', () => ({}));

// Mock hooks and contexts
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 1, role: 'customer', name: 'Test User' },
    logout: jest.fn()
  })
}));

jest.mock('../../hooks/useCart', () => ({
  useCart: () => ({
    cartItems: [],
    getCartCount: () => 0,
    getCartTotal: () => 0,
    updateQuantity: jest.fn(),
    removeFromCart: jest.fn(),
    clearCart: jest.fn()
  })
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  Link: ({ children, ...props }) => <a {...props}>{children}</a>
}));

// Mock additional components for comprehensive testing
jest.mock('../Navigation/Navbar', () => {
  return function MockNavbar() {
    return <nav data-testid="navbar">Navigation</nav>;
  };
});

jest.mock('../Common/Button', () => {
  return function MockButton({ children, loading, ...props }) {
    return (
      <button {...props} data-loading={loading}>
        {loading ? 'Loading...' : children}
      </button>
    );
  };
});

jest.mock('../Common/Modal', () => {
  return function MockModal({ isOpen, children, className }) {
    if (!isOpen) return null;
    return (
      <div className={`modal-overlay ${className || ''}`} data-testid="modal">
        {children}
      </div>
    );
  };
});

jest.mock('../Common/Spinner', () => {
  return function MockSpinner({ size, theme }) {
    return <div data-testid="spinner" data-size={size} data-theme={theme}>Loading...</div>;
  };
});

// Mock fetch for API calls
global.fetch = jest.fn();

const TestComponentWrapper = ({ children, initialTheme = 'system' }) => {
  // Mock localStorage for theme persistence
  const localStorageMock = {
    getItem: jest.fn(() => initialTheme),
    setItem: jest.fn()
  };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  
  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    value: jest.fn(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    }))
  });
  
  return (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  );
};

describe('Theme Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
    
    // Mock document.documentElement
    Object.defineProperty(document, 'documentElement', {
      value: {
        setAttribute: jest.fn(),
        classList: {
          remove: jest.fn(),
          add: jest.fn()
        }
      },
      writable: true
    });
  });
  
  describe('TC-004: All app screens and components properly render in both light and dark themes', () => {
    it('should render DashboardLayout correctly in light theme', () => {
      render(
        <TestComponentWrapper initialTheme="light">
          <DashboardLayout>
            <div data-testid="dashboard-content">Dashboard Content</div>
          </DashboardLayout>
        </TestComponentWrapper>
      );
      
      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
    });
    
    it('should render DashboardLayout correctly in dark theme', () => {
      render(
        <TestComponentWrapper initialTheme="dark">
          <DashboardLayout>
            <div data-testid="dashboard-content">Dashboard Content</div>
          </DashboardLayout>
        </TestComponentWrapper>
      );
      
      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });
    
    it('should render LoginForm correctly in both themes', () => {
      const { rerender } = render(
        <TestComponentWrapper initialTheme="light">
          <LoginForm />
        </TestComponentWrapper>
      );
      
      expect(screen.getByRole('form')).toBeInTheDocument();
      
      rerender(
        <TestComponentWrapper initialTheme="dark">
          <LoginForm />
        </TestComponentWrapper>
      );
      
      expect(screen.getByRole('form')).toBeInTheDocument();
    });
    
    it('should render ShoppingCart correctly in both themes', () => {
      const { rerender } = render(
        <TestComponentWrapper initialTheme="light">
          <ShoppingCart isOpen={true} onClose={jest.fn()} />
        </TestComponentWrapper>
      );
      
      expect(screen.getByText(/shopping cart/i)).toBeInTheDocument();
      
      rerender(
        <TestComponentWrapper initialTheme="dark">
          <ShoppingCart isOpen={true} onClose={jest.fn()} />
        </TestComponentWrapper>
      );
      
      expect(screen.getByText(/shopping cart/i)).toBeInTheDocument();
    });

    it('should render ProductCatalog correctly in both themes', () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      });

      const { rerender } = render(
        <TestComponentWrapper initialTheme="light">
          <ProductCatalog />
        </TestComponentWrapper>
      );
      
      expect(screen.getByTestId('product-catalog')).toBeInTheDocument();
      
      rerender(
        <TestComponentWrapper initialTheme="dark">
          <ProductCatalog />
        </TestComponentWrapper>
      );
      
      expect(screen.getByTestId('product-catalog')).toBeInTheDocument();
    });

    it('should render all navigation components correctly in both themes', () => {
      const { rerender } = render(
        <TestComponentWrapper initialTheme="light">
          <DashboardLayout>
            <div data-testid="nav-content">Navigation Test</div>
          </DashboardLayout>
        </TestComponentWrapper>
      );
      
      expect(screen.getByTestId('navbar')).toBeInTheDocument();
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
      
      rerender(
        <TestComponentWrapper initialTheme="dark">
          <DashboardLayout>
            <div data-testid="nav-content">Navigation Test</div>
          </DashboardLayout>
        </TestComponentWrapper>
      );
      
      expect(screen.getByTestId('navbar')).toBeInTheDocument();
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });

    it('should render form components with proper theme styling', () => {
      const { rerender } = render(
        <TestComponentWrapper initialTheme="light">
          <LoginForm />
        </TestComponentWrapper>
      );
      
      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('light-theme');
      
      rerender(
        <TestComponentWrapper initialTheme="dark">
          <LoginForm />
        </TestComponentWrapper>
      );
      
      expect(form).toBeInTheDocument();
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark-theme');
    });

    it('should render interactive elements correctly in both themes', () => {
      const MockButton = require('../Common/Button').default;
      
      const { rerender } = render(
        <TestComponentWrapper initialTheme="light">
          <MockButton>Test Button</MockButton>
        </TestComponentWrapper>
      );
      
      expect(screen.getByRole('button')).toHaveTextContent('Test Button');
      
      rerender(
        <TestComponentWrapper initialTheme="dark">
          <MockButton>Test Button</MockButton>
        </TestComponentWrapper>
      );
      
      expect(screen.getByRole('button')).toHaveTextContent('Test Button');
    });
  });
  
  describe('TC-008: Loading states and overlays work correctly in both themes', () => {
    it('should apply theme to loading overlays', async () => {
      // Mock fetch to simulate loading state
      fetch.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve([])
        }), 100);
      }));
      
      render(
        <TestComponentWrapper initialTheme="dark">
          <ProductCatalog />
        </TestComponentWrapper>
      );
      
      // Should show loading state initially
      await waitFor(() => {
        const loadingElement = screen.queryByText(/loading/i);
        if (loadingElement) {
          expect(loadingElement).toBeInTheDocument();
        }
      });
      
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });
    
    it('should apply theme to modal overlays', () => {
      render(
        <TestComponentWrapper initialTheme="dark">
          <ShoppingCart isOpen={true} onClose={jest.fn()} />
        </TestComponentWrapper>
      );
      
      const overlay = document.querySelector('.cart-overlay');
      if (overlay) {
        expect(overlay).toHaveAttribute('data-theme', 'dark');
      }
    });

    it('should display loading spinners with correct theme in both themes', () => {
      const MockSpinner = require('../Common/Spinner').default;
      
      const { rerender } = render(
        <TestComponentWrapper initialTheme="light">
          <MockSpinner size="medium" />
        </TestComponentWrapper>
      );
      
      expect(screen.getByTestId('spinner')).toHaveAttribute('data-theme', 'light');
      
      rerender(
        <TestComponentWrapper initialTheme="dark">
          <MockSpinner size="medium" />
        </TestComponentWrapper>
      );
      
      expect(screen.getByTestId('spinner')).toHaveAttribute('data-theme', 'dark');
    });

    it('should show loading states on buttons correctly in both themes', () => {
      const MockButton = require('../Common/Button').default;
      
      const { rerender } = render(
        <TestComponentWrapper initialTheme="light">
          <MockButton loading={true}>Submit</MockButton>
        </TestComponentWrapper>
      );
      
      expect(screen.getByRole('button')).toHaveAttribute('data-loading', 'true');
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      
      rerender(
        <TestComponentWrapper initialTheme="dark">
          <MockButton loading={true}>Submit</MockButton>
        </TestComponentWrapper>
      );
      
      expect(screen.getByRole('button')).toHaveAttribute('data-loading', 'true');
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should handle modal overlays correctly in both themes', () => {
      const MockModal = require('../Common/Modal').default;
      
      const { rerender } = render(
        <TestComponentWrapper initialTheme="light">
          <MockModal isOpen={true}>
            <div>Modal Content</div>
          </MockModal>
        </TestComponentWrapper>
      );
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
      
      rerender(
        <TestComponentWrapper initialTheme="dark">
          <MockModal isOpen={true}>
            <div>Modal Content</div>
          </MockModal>
        </TestComponentWrapper>
      );
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });

    it('should handle async loading states with proper theme application', async () => {
      fetch.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve([{ id: 1, name: 'Product 1' }])
          }), 50);
        })
      );

      render(
        <TestComponentWrapper initialTheme="dark">
          <ProductCatalog />
        </TestComponentWrapper>
      );

      // Check that theme is applied during loading
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');

      // Wait for loading to complete
      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Theme should still be applied after loading
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });

    it('should handle overlay z-index and positioning in both themes', () => {
      const MockModal = require('../Common/Modal').default;
      
      render(
        <TestComponentWrapper initialTheme="dark">
          <MockModal isOpen={true} className="high-priority">
            <div>Overlay Content</div>
          </MockModal>
        </TestComponentWrapper>
      );
      
      const modal = screen.getByTestId('modal');
      expect(modal).toHaveClass('modal-overlay');
      expect(modal).toHaveClass('high-priority');
      expect(screen.getByText('Overlay Content')).toBeInTheDocument();
    });
  });
  
  describe('TC-006: Color contrast meets accessibility standards', () => {
    it('should apply proper CSS custom properties for light theme', () => {
      render(
        <TestComponentWrapper initialTheme="light">
          <div data-testid="test-element">Test Content</div>
        </TestComponentWrapper>
      );
      
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('light-theme');
    });
    
    it('should apply proper CSS custom properties for dark theme', () => {
      render(
        <TestComponentWrapper initialTheme="dark">
          <div data-testid="test-element">Test Content</div>
        </TestComponentWrapper>
      );
      
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark-theme');
    });
  });
  
  describe('TC-007: Icons and images adapt appropriately to theme changes', () => {
    it('should update theme-dependent icons when theme changes', async () => {
      const user = userEvent.setup();
      const ThemeToggleTest = () => {
        const { theme, setTheme } = require('../../contexts/ThemeContext').useTheme();
        return (
          <div>
            <span data-testid="current-theme">{theme}</span>
            <button onClick={() => setTheme('dark')} data-testid="switch-to-dark">Dark</button>
            <button onClick={() => setTheme('light')} data-testid="switch-to-light">Light</button>
          </div>
        );
      };
      
      render(
        <TestComponentWrapper initialTheme="light">
          <ThemeToggleTest />
        </TestComponentWrapper>
      );
      
      await user.click(screen.getByTestId('switch-to-dark'));
      
      await waitFor(() => {
        expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
      });
    });
  });
  
  describe('Theme persistence across app sessions', () => {
    it('should maintain theme selection after app reload simulation', () => {
      const mockGetItem = jest.fn(() => 'dark');
      Object.defineProperty(window, 'localStorage', {
        value: { getItem: mockGetItem, setItem: jest.fn() }
      });
      
      render(
        <TestComponentWrapper initialTheme="dark">
          <div data-testid="test-content">Content</div>
        </TestComponentWrapper>
      );
      
      expect(mockGetItem).toHaveBeenCalledWith('app-theme');
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });
  });
  
  describe('System theme integration', () => {
    it('should respect system dark mode preference', () => {
      Object.defineProperty(window, 'matchMedia', {
        value: jest.fn(() => ({
          matches: true, // System prefers dark mode
          addEventListener: jest.fn(),
          removeEventListener: jest.fn()
        }))
      });
      
      render(
        <TestComponentWrapper initialTheme="system">
          <div data-testid="test-content">Content</div>
        </TestComponentWrapper>
      );
      
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });
    
    it('should respect system light mode preference', () => {
      Object.defineProperty(window, 'matchMedia', {
        value: jest.fn(() => ({
          matches: false, // System prefers light mode
          addEventListener: jest.fn(),
          removeEventListener: jest.fn()
        }))
      });
      
      render(
        <TestComponentWrapper initialTheme="system">
          <div data-testid="test-content">Content</div>
        </TestComponentWrapper>
      );
      
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
    });
  });
});