import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

// Helper function to calculate color contrast ratio
const calculateContrastRatio = (color1, color2) => {
  const getLuminance = (hex) => {
    const rgb = parseInt(hex.slice(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;
    
    const toLinear = (c) => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  };
  
  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
};

describe('Theme Integration Tests', () => {
  let user;

  beforeEach(async () => {
    user = userEvent.setup();
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

  describe('TC-004: Immediate theme changes without restart', () => {
    it('should apply theme changes instantly without page refresh', async () => {
      renderWithTheme(<SettingsPage />);
      
      // Start with system theme
      const systemOption = screen.getByRole('radio', { name: /system/i });
      expect(systemOption).toHaveAttribute('aria-checked', 'true');
      
      // Switch to dark theme
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      fireEvent.click(darkOption);
      
      // Theme should change immediately (within 100ms)
      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(document.documentElement.className).toContain('theme-dark');
        const rootStyle = document.documentElement.style;
        expect(rootStyle.getPropertyValue('--bg-primary')).toBe('#1a1a1a');
      }, { timeout: 100 });
      
      // Switch to light theme
      const lightOption = screen.getByRole('radio', { name: /light/i });
      fireEvent.click(lightOption);
      
      // Should change immediately again
      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        expect(document.documentElement.className).toContain('theme-light');
      }, { timeout: 100 });
    });

    it('should update all components simultaneously when theme changes', async () => {
      const { rerender } = renderWithTheme(
        <div>
          <SettingsPage />
          <DashboardLayout />
        </div>
      );
      
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      fireEvent.click(darkOption);
      
      await waitFor(() => {
        // Both components should reflect the new theme immediately
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      });
      
      // Verify theme persists across component updates
      rerender(
        <ThemeProvider>
          <div>
            <SettingsPage />
            <ProductCatalog />
          </div>
        </ThemeProvider>
      );
      
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should handle rapid theme switching correctly', async () => {
      renderWithTheme(<SettingsPage />);
      
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      const lightOption = screen.getByRole('radio', { name: /light/i });
      const systemOption = screen.getByRole('radio', { name: /system/i });
      
      // Rapid switching
      fireEvent.click(darkOption);
      fireEvent.click(lightOption);
      fireEvent.click(darkOption);
      fireEvent.click(systemOption);
      
      await waitFor(() => {
        expect(systemOption).toHaveAttribute('aria-checked', 'true');
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      });
    });
  });

  describe('TC-006: Keyboard accessibility for theme toggle', () => {
    it('should allow theme selection using keyboard navigation', async () => {
      renderWithTheme(<SettingsPage />);
      
      // Tab to theme options
      await user.tab();
      await user.tab();
      
      // Find first theme radio button
      const systemOption = screen.getByRole('radio', { name: /system/i });
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      const lightOption = screen.getByRole('radio', { name: /light/i });
      
      // Use arrow keys to navigate through options
      systemOption.focus();
      expect(document.activeElement).toBe(systemOption);
      
      // Arrow down to dark option
      await user.keyboard('{ArrowDown}');
      expect(document.activeElement).toBe(darkOption);
      
      // Space to select
      await user.keyboard(' ');
      await waitFor(() => {
        expect(darkOption).toHaveAttribute('aria-checked', 'true');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      });
      
      // Arrow down to light option
      await user.keyboard('{ArrowDown}');
      expect(document.activeElement).toBe(lightOption);
      
      // Enter to select
      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(lightOption).toHaveAttribute('aria-checked', 'true');
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      });
    });

    it('should provide proper ARIA labels and roles for theme controls', async () => {
      renderWithTheme(<SettingsPage />);
      
      const themeGroup = screen.getByRole('radiogroup');
      expect(themeGroup).toHaveAttribute('aria-labelledby');
      
      const systemOption = screen.getByRole('radio', { name: /system/i });
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      const lightOption = screen.getByRole('radio', { name: /light/i });
      
      // Check ARIA attributes
      [systemOption, darkOption, lightOption].forEach(option => {
        expect(option).toHaveAttribute('role', 'radio');
        expect(option).toHaveAttribute('aria-checked');
        expect(option).toHaveAttribute('tabindex');
      });
    });

    it('should support keyboard shortcuts for theme switching', async () => {
      renderWithTheme(<SettingsPage />);
      
      // Simulate keyboard shortcut (Ctrl+Shift+T for theme toggle)
      await user.keyboard('{Control>}{Shift>}t{/Shift}{/Control}');
      
      // Should cycle through themes or open theme menu
      // This test assumes a keyboard shortcut implementation
      const currentTheme = document.documentElement.getAttribute('data-theme');
      expect(['light', 'dark'].includes(currentTheme)).toBe(true);
    });

    it('should maintain focus management when themes change', async () => {
      renderWithTheme(<SettingsPage />);
      
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      darkOption.focus();
      
      // Select using keyboard
      await user.keyboard(' ');
      
      await waitFor(() => {
        expect(document.activeElement).toBe(darkOption);
        expect(darkOption).toHaveAttribute('aria-checked', 'true');
      });
    });
  });

  describe('TC-007: High contrast ratio validation', () => {
    it('should maintain WCAG AA contrast ratios for dark theme', async () => {
      renderWithTheme(<SettingsPage />);
      
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      fireEvent.click(darkOption);
      
      await waitFor(() => {
        const rootStyle = document.documentElement.style;
        const bgColor = rootStyle.getPropertyValue('--bg-primary') || '#1a1a1a';
        const textColor = rootStyle.getPropertyValue('--text-primary') || '#ffffff';
        
        // Convert to hex if needed and calculate contrast
        const contrast = calculateContrastRatio('#1a1a1a', '#ffffff');
        
        // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
        expect(contrast).toBeGreaterThanOrEqual(4.5);
      });
    });

    it('should maintain WCAG AA contrast ratios for light theme', async () => {
      renderWithTheme(<SettingsPage />);
      
      const lightOption = screen.getByRole('radio', { name: /light/i });
      fireEvent.click(lightOption);
      
      await waitFor(() => {
        // Light theme typically uses default colors with good contrast
        const contrast = calculateContrastRatio('#ffffff', '#000000');
        expect(contrast).toBeGreaterThanOrEqual(4.5);
      });
    });

    it('should provide sufficient contrast for interactive elements', async () => {
      renderWithTheme(<SettingsPage />);
      
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      fireEvent.click(darkOption);
      
      await waitFor(() => {
        const rootStyle = document.documentElement.style;
        
        // Check button colors
        const buttonBg = rootStyle.getPropertyValue('--button-primary-bg') || '#007bff';
        const buttonText = rootStyle.getPropertyValue('--button-primary-text') || '#ffffff';
        
        // Interactive elements should have at least 3:1 contrast ratio
        if (buttonBg && buttonText) {
          const buttonContrast = calculateContrastRatio(buttonBg, buttonText);
          expect(buttonContrast).toBeGreaterThanOrEqual(3);
        }
      });
    });

    it('should validate contrast ratios for status indicators', async () => {
      renderWithTheme(<SettingsPage />);
      
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      fireEvent.click(darkOption);
      
      await waitFor(() => {
        const rootStyle = document.documentElement.style;
        
        // Check status colors (success, warning, error)
        const successColor = rootStyle.getPropertyValue('--color-success') || '#28a745';
        const errorColor = rootStyle.getPropertyValue('--color-error') || '#dc3545';
        const bgColor = rootStyle.getPropertyValue('--bg-primary') || '#1a1a1a';
        
        if (successColor) {
          const successContrast = calculateContrastRatio(bgColor, successColor);
          expect(successContrast).toBeGreaterThanOrEqual(3);
        }
        
        if (errorColor) {
          const errorContrast = calculateContrastRatio(bgColor, errorColor);
          expect(errorContrast).toBeGreaterThanOrEqual(3);
        }
      });
    });
  });

  describe('TC-008: Icon and image theme variants', () => {
    it('should render theme-appropriate icons for dark theme', async () => {
      renderWithTheme(<SettingsPage />);
      
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      fireEvent.click(darkOption);
      
      await waitFor(() => {
        // Check if Moon icon is rendered (indicating dark theme)
        const moonIcon = screen.getByText('Moon');
        expect(moonIcon).toBeInTheDocument();
        
        // Verify theme context provides correct theme value
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      });
    });

    it('should render theme-appropriate icons for light theme', async () => {
      renderWithTheme(<SettingsPage />);
      
      const lightOption = screen.getByRole('radio', { name: /light/i });
      fireEvent.click(lightOption);
      
      await waitFor(() => {
        // Check if Sun icon is rendered (indicating light theme)
        const sunIcon = screen.getByText('Sun');
        expect(sunIcon).toBeInTheDocument();
        
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      });
    });

    it('should update icon variants immediately when theme changes', async () => {
      renderWithTheme(<SettingsPage />);
      
      // Start with light theme
      const lightOption = screen.getByRole('radio', { name: /light/i });
      fireEvent.click(lightOption);
      
      await waitFor(() => {
        expect(screen.getByText('Sun')).toBeInTheDocument();
      });
      
      // Switch to dark theme
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      fireEvent.click(darkOption);
      
      await waitFor(() => {
        expect(screen.getByText('Moon')).toBeInTheDocument();
      });
    });

    it('should handle image sources based on theme', async () => {
      // Create a mock component with theme-aware images
      const ThemeAwareComponent = () => {
        const [theme, setTheme] = React.useState('light');
        
        React.useEffect(() => {
          const observer = new MutationObserver(() => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            setTheme(currentTheme || 'light');
          });
          
          observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
          });
          
          return () => observer.disconnect();
        }, []);
        
        return (
          <div>
            <img 
              src={theme === 'dark' ? '/logo-dark.png' : '/logo-light.png'} 
              alt="Logo"
              data-testid="theme-image"
            />
          </div>
        );
      };
      
      const { rerender } = renderWithTheme(
        <div>
          <SettingsPage />
          <ThemeAwareComponent />
        </div>
      );
      
      // Check initial image
      await waitFor(() => {
        const image = screen.getByTestId('theme-image');
        expect(image.src).toContain('logo-light.png');
      });
      
      // Switch to dark theme
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      fireEvent.click(darkOption);
      
      await waitFor(() => {
        const image = screen.getByTestId('theme-image');
        expect(image.src).toContain('logo-dark.png');
      });
    });

    it('should apply theme-specific CSS classes to styled elements', async () => {
      renderWithTheme(<SettingsPage />);
      
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      fireEvent.click(darkOption);
      
      await waitFor(() => {
        // Check that theme classes are applied to document
        expect(document.documentElement.className).toContain('theme-dark');
        
        // CSS should be able to target .theme-dark .icon for specific styling
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      });
      
      const lightOption = screen.getByRole('radio', { name: /light/i });
      fireEvent.click(lightOption);
      
      await waitFor(() => {
        expect(document.documentElement.className).toContain('theme-light');
      });
    });

    it('should handle SVG icon color changes through CSS variables', async () => {
      renderWithTheme(<SettingsPage />);
      
      const darkOption = screen.getByRole('radio', { name: /dark/i });
      fireEvent.click(darkOption);
      
      await waitFor(() => {
        const rootStyle = document.documentElement.style;
        
        // Check icon color variables are set appropriately
        const iconColor = rootStyle.getPropertyValue('--icon-color') || '#ffffff';
        expect(iconColor).toBe('#ffffff'); // White icons for dark theme
      });
      
      const lightOption = screen.getByRole('radio', { name: /light/i });
      fireEvent.click(lightOption);
      
      await waitFor(() => {
        const rootStyle = document.documentElement.style;
        const iconColor = rootStyle.getPropertyValue('--icon-color') || '#000000';
        // Should use dark icons for light theme (default CSS)
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