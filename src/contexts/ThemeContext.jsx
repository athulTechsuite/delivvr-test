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

  // Get system theme preference
  const getSystemTheme = () => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  };

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme && ['light', 'dark', 'system'].includes(storedTheme)) {
      setTheme(storedTheme);
    }
  }, []);

  // Update resolved theme when theme changes or system preference changes
  useEffect(() => {
    let currentTheme = theme;
    
    if (theme === 'system') {
      currentTheme = getSystemTheme();
    }

    setResolvedTheme(currentTheme);
    
    // Apply theme to document root
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(currentTheme);
    
    // Set CSS custom property for theme
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      if (theme === 'system') {
        const systemTheme = getSystemTheme();
        setResolvedTheme(systemTheme);
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(systemTheme);
        document.documentElement.setAttribute('data-theme', systemTheme);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setThemePreference = (newTheme) => {
    if (!['light', 'dark', 'system'].includes(newTheme)) {
      console.warn(`Invalid theme: ${newTheme}. Valid options: light, dark, system`);
      return;
    }
    
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const toggleTheme = () => {
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light';
    setThemePreference(newTheme);
  };

  const value = {
    theme, // Current theme setting (light, dark, or system)
    resolvedTheme, // Actual theme being used (light or dark)
    setTheme: setThemePreference,
    toggleTheme,
    isSystemTheme: theme === 'system',
    isDarkMode: resolvedTheme === 'dark',
    isLightMode: resolvedTheme === 'light'
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;