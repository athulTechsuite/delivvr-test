import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from '../ThemeContext';

// Test component to access theme context
const TestComponent = () => {
  const { theme, setTheme, effectiveTheme } = useTheme();
  return (
    <div data-testid="theme-test">
      <span data-testid="current-theme">{theme}</span>
      <span data-testid="effective-theme">{effectiveTheme}</span>
      <button data-testid="set-light" onClick={() => setTheme('light')}>Light</button>
      <button data-testid="set-dark" onClick={() => setTheme('dark')}>Dark</button>
      <button data-testid="set-system" onClick={() => setTheme('system')}>System</button>
    </div>
  );
};

describe('ThemeContext', () => {
  let mockMatchMedia;
  
  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn()
    };
    global.localStorage = localStorageMock;
    
    // Mock matchMedia
    mockMatchMedia = jest.fn();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia
    });
    
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
  
  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });
  
  describe('TC-003: Theme selection is persisted across app sessions', () => {
    it('should load saved theme from localStorage', () => {
      localStorage.getItem.mockReturnValue('dark');
      
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );
      
      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    });
    
    it('should save theme changes to localStorage', async () => {
      const user = userEvent.setup();
      localStorage.getItem.mockReturnValue('light');
      
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );
      
      await user.click(screen.getByTestId('set-dark'));
      
      expect(localStorage.setItem).toHaveBeenCalledWith('app-theme', 'dark');
    });
    
    it('should default to system theme when no saved preference exists', () => {
      localStorage.getItem.mockReturnValue(null);
      mockMatchMedia.mockReturnValue({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() });
      
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );
      
      expect(screen.getByTestId('current-theme')).toHaveTextContent('system');
    });
  });
  
  describe('TC-002: User can select between Light, Dark, and System theme options', () => {
    beforeEach(() => {
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      });
    });
    
    it('should allow switching to light theme', async () => {
      const user = userEvent.setup();
      
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );
      
      await user.click(screen.getByTestId('set-light'));
      
      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
      expect(screen.getByTestId('effective-theme')).toHaveTextContent('light');
    });
    
    it('should allow switching to dark theme', async () => {
      const user = userEvent.setup();
      
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );
      
      await user.click(screen.getByTestId('set-dark'));
      
      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
      expect(screen.getByTestId('effective-theme')).toHaveTextContent('dark');
    });
    
    it('should allow switching to system theme', async () => {
      const user = userEvent.setup();
      
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );
      
      await user.click(screen.getByTestId('set-system'));
      
      expect(screen.getByTestId('current-theme')).toHaveTextContent('system');
    });
  });
  
  describe('TC-005: Theme changes apply immediately without requiring app restart', () => {
    beforeEach(() => {
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      });
    });
    
    it('should apply theme to DOM immediately when changed', async () => {
      const user = userEvent.setup();
      
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );
      
      await user.click(screen.getByTestId('set-dark'));
      
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark-theme');
    });
    
    it('should update effective theme when system preference is selected', async () => {
      const user = userEvent.setup();
      mockMatchMedia.mockReturnValue({
        matches: true, // Dark system preference
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      });
      
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );
      
      await user.click(screen.getByTestId('set-system'));
      
      expect(screen.getByTestId('effective-theme')).toHaveTextContent('dark');
    });
  });
  
  describe('System theme detection', () => {
    it('should detect light system theme', () => {
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      });
      
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );
      
      // When system theme is selected, it should show light
      expect(screen.getByTestId('effective-theme')).toHaveTextContent('light');
    });
    
    it('should detect dark system theme', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      });
      
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );
      
      expect(screen.getByTestId('effective-theme')).toHaveTextContent('dark');
    });
    
    it('should respond to system theme changes', async () => {
      const mockEventListener = jest.fn();
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: mockEventListener,
        removeEventListener: jest.fn()
      });
      
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );
      
      // Simulate system theme change
      const changeHandler = mockEventListener.mock.calls[0][1];
      act(() => {
        changeHandler({ matches: true });
      });
      
      await waitFor(() => {
        expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
      });
    });
  });
  
  describe('Error handling', () => {
    it('should handle localStorage errors gracefully', () => {
      localStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to read theme from localStorage:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
    
    it('should throw error when useTheme is used outside provider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestComponent />);
      }).toThrow('useTheme must be used within a ThemeProvider');
      
      consoleSpy.mockRestore();
    });
  });
});