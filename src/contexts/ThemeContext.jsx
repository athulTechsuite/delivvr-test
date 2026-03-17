import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('system');
  const [resolvedTheme, setResolvedTheme] = useState('light');

  // Detect system theme preference
  const getSystemTheme = () => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  };

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setTheme(savedTheme);
      } else {
        setTheme('system');
      }
    } catch (error) {
      // localStorage may not be available in private/incognito mode
      console.warn('localStorage not available:', error);
      setTheme('system');
    }
  }, []);

  // Update resolved theme based on current theme setting
  useEffect(() => {
    let newResolvedTheme;
    
    if (theme === 'system') {
      newResolvedTheme = getSystemTheme();
    } else {
      newResolvedTheme = theme;
    }

    setResolvedTheme(newResolvedTheme);
    
    // Apply theme to document root
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(`theme-${newResolvedTheme}`);
    
    // Set data attribute for CSS targeting
    root.setAttribute('data-theme', newResolvedTheme);
    
    // Update CSS custom properties
    if (newResolvedTheme === 'dark') {
      root.style.setProperty('--bg-primary', '#1a1a1a');
      root.style.setProperty('--bg-secondary', '#2d2d2d');
      root.style.setProperty('--bg-tertiary', '#404040');
      root.style.setProperty('--text-primary', '#ffffff');
      root.style.setProperty('--text-secondary', '#e0e0e0');
      root.style.setProperty('--text-muted', '#a0a0a0');
      root.style.setProperty('--border-color', '#404040');
      root.style.setProperty('--border-hover', '#606060');
      root.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.5)');
      root.style.setProperty('--accent-primary', '#3b82f6');
      root.style.setProperty('--accent-hover', '#2563eb');
      root.style.setProperty('--success-color', '#10b981');
      root.style.setProperty('--error-color', '#ef4444');
      root.style.setProperty('--warning-color', '#f59e0b');
    } else {
      root.style.setProperty('--bg-primary', '#ffffff');
      root.style.setProperty('--bg-secondary', '#f8f9fa');
      root.style.setProperty('--bg-tertiary', '#e9ecef');
      root.style.setProperty('--text-primary', '#212529');
      root.style.setProperty('--text-secondary', '#495057');
      root.style.setProperty('--text-muted', '#6c757d');
      root.style.setProperty('--border-color', '#dee2e6');
      root.style.setProperty('--border-hover', '#adb5bd');
      root.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.1)');
      root.style.setProperty('--accent-primary', '#3b82f6');
      root.style.setProperty('--accent-hover', '#2563eb');
      root.style.setProperty('--success-color', '#10b981');
      root.style.setProperty('--error-color', '#ef4444');
      root.style.setProperty('--warning-color', '#f59e0b');
    }
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      if (theme === 'system') {
        const newSystemTheme = getSystemTheme();
        setResolvedTheme(newSystemTheme);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setThemeAndPersist = (newTheme) => {
    setTheme(newTheme);
    try {
      localStorage.setItem('theme', newTheme);
    } catch (error) {
      // localStorage may not be available in private/incognito mode
      console.warn('Failed to persist theme to localStorage:', error);
    }
  };

  const toggleTheme = () => {
    if (resolvedTheme === 'light') {
      setThemeAndPersist('dark');
    } else {
      setThemeAndPersist('light');
    }
  };

  const value = {
    theme,
    resolvedTheme,
    setTheme: setThemeAndPersist,
    toggleTheme,
    isDark: resolvedTheme === 'dark',
    isLight: resolvedTheme === 'light',
    isSystem: theme === 'system'
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;