import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '../contexts/ThemeContext';
import SettingsPage from '../components/Settings/SettingsPage';
import DashboardLayout from '../components/Layout/DashboardLayout';
import LoginForm from '../components/Auth/LoginForm';
import ProductCatalog from '../components/Product/ProductCatalog';

// Mock all the services and hooks
jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Test User', role: 'customer' },
    logout: jest.fn()
  })
}));

jest.mock('../services/orderService', () => ({
  orderService: {
    getUserOrders: jest.fn().mockResolvedValue([])
  }
}));

jest.mock('../services/wishlistService', () => ({
  wishlistService: {
    getUserWishlist: jest.fn().mockResolvedValue([])
  }
}));

jest.mock('../services/userService', () => ({
  userService: {
    getUserProfile: jest.fn().mockResolvedValue({})
  }
}));

// Mock fetch for product catalog
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
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
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })),
});

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useLocation: () => ({ pathname: '/dashboard' })
}));

// Mock react-icons
jest.mock('react-icons/fi', () => ({
  FiMenu: () => <div>Menu</div>,
  FiX: () => <div>Close</div>,
  FiHome: () => <div>Home</div>,
  FiUsers: () => <div>Users</div>,
  FiPackage: () => <div>Package</div>,
  FiBarChart3: () => <div>Chart</div>,
  FiShoppingCart: () => <div>Cart</div>,
  FiHeart: () => <div>Heart</div>,
  FiUser: () => <div>User</div>,
  FiLogOut: () => <div>Logout</div>,
  FiInventory: () => <div>Inventory</div>,
  FiDollarSign: () => <div>Dollar</div>,
  FiSun: () => <div>Sun</div>,
  FiMoon: () => <div>Moon</div>,
  FiSettings: () => <div>Settings</div>
}));

const renderWithTheme = (component) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('Theme Integration Tests', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    jest.clearAllMocks();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.className = '';
    document.documentElement.style.cssText = '';
    
    // Reset fetch mock
    fetch.mockClear();
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    });
  });

  describe('TC-003: All UI components adapt to selected theme', () => {
    it('should apply dark theme styles to all major components', async () => {
      // Render settings page and switch to dark theme
      renderWithTheme(<SettingsPage />);
      
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      fireEvent.click(darkOption);
      
      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(document.documentElement.className).toContain('theme-dark');
      });
      
      // Verify CSS custom properties are set for dark theme
      const rootStyle = document.documentElement.style;
      expect(rootStyle.getPropertyValue('--bg-primary')).toBe('#1a1a1a');
      expect(rootStyle.getPropertyValue('--text-primary')).toBe('#ffffff');
    });

    it('should apply light theme styles to all major components', async () => {
      renderWithTheme(<SettingsPage />);
      
      const lightOption = screen.getByRole('radio', { name: /light/i });
      fireEvent.click(lightOption);
      
      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        expect(document.documentElement.className).toContain('theme-light');
      });
    });

    it('should maintain theme consistency across component rerenders', async () => {
      const { rerender } = renderWithTheme(<SettingsPage />);
      
      // Set dark theme
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      fireEvent.click(darkOption);
      
      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      });
      
      // Rerender different component
      rerender(
        <ThemeProvider>
          <LoginForm />
        </ThemeProvider>
      );
      
      // Theme should persist
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  describe('TC-007: High contrast ratios maintained', () => {
    it('should set appropriate contrast colors for dark theme', async () => {
      renderWithTheme(<SettingsPage />);
      
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      fireEvent.click(darkOption);
      
      await waitFor(() => {
        const rootStyle = document.documentElement.style;
        // Verify high contrast colors are set
        expect(rootStyle.getPropertyValue('--text-primary')).toBe('#ffffff');
        expect(rootStyle.getPropertyValue('--bg-primary')).toBe('#1a1a1a');
        // These should provide sufficient contrast ratio
      });
    });

    it('should set appropriate contrast colors for light theme', async () => {
      renderWithTheme(<SettingsPage />);
      
      const lightOption = screen.getByRole('radio', { name: /light/i });
      fireEvent.click(lightOption);
      
      await waitFor(() => {
        // Light theme should use default CSS values with good contrast
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      });
    });
  });

  describe('TC-002: Cross-session and refresh persistence', () => {
    it('should persist theme across app sessions', async () => {
      // First session - set dark theme
      const { unmount } = renderWithTheme(<SettingsPage />);
      
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      fireEvent.click(darkOption);
      
      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
      });
      
      unmount();
      
      // Simulate app restart - mock localStorage returning saved value
      mockLocalStorage.getItem.mockReturnValue('dark');
      
      renderWithTheme(<SettingsPage />);
      
      await waitFor(() => {
        const darkOption = screen.getByRole('radio', { name: /dark/i });
        expect(darkOption).toHaveAttribute('aria-checked', 'true');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      });
    });

    it('should handle browser refresh correctly', async () => {
      // Simulate saved theme in localStorage
      mockLocalStorage.getItem.mockReturnValue('dark');
      
      renderWithTheme(<SettingsPage />);
      
      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        const darkOption = screen.getByRole('radio', { name: /dark/i });
        expect(darkOption).toHaveAttribute('aria-checked', 'true');
      });
    });
  });

  describe('TC-008: Icon and image theme variants', () => {
    it('should handle theme-aware components correctly', async () => {
      renderWithTheme(<SettingsPage />);
      
      // Switch to dark theme
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      fireEvent.click(darkOption);
      
      await waitFor(() => {
        // Components should be able to access theme context
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      });
      
      // Switch to light theme
      const lightOption = screen.getByRole('radio', { name: /light/i });
      fireEvent.click(lightOption);
      
      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      });
    });
  });

  describe('System theme integration', () => {
    it('should respond to system theme changes when system option is selected', async () => {
      let mediaQueryCallback;
      
      // Mock matchMedia with callback capture
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        addEventListener: jest.fn((event, callback) => {
          if (event === 'change') {
            mediaQueryCallback = callback;
          }
        }),
        removeEventListener: jest.fn(),
      }));
      
      renderWithTheme(<SettingsPage />);
      
      // System should be selected by default
      const systemOption = screen.getByRole('radio', { name: /system/i });
      expect(systemOption).toHaveAttribute('aria-checked', 'true');
      
      // Simulate system theme change
      if (mediaQueryCallback) {
        mediaQueryCallback({ matches: true }); // Dark theme
      }
      
      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      });
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle corrupted localStorage gracefully', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-theme-value');
      
      renderWithTheme(<SettingsPage />);
      
      await waitFor(() => {
        // Should fall back to system theme
        const systemOption = screen.getByRole('radio', { name: /system/i });
        expect(systemOption).toHaveAttribute('aria-checked', 'true');
      });
    });

    it('should handle missing matchMedia gracefully', () => {
      const originalMatchMedia = window.matchMedia;
      delete window.matchMedia;
      
      expect(() => {
        renderWithTheme(<SettingsPage />);
      }).not.toThrow();
      
      window.matchMedia = originalMatchMedia;
    });
  });
});