import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const THEME_OPTIONS = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

const STORAGE_KEY = 'theme-preference';

export const ThemeProvider = ({ children }) => {
  const [themePreference, setThemePreference] = useState(() => {
    // Get saved preference from localStorage or default to system
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved || THEME_OPTIONS.SYSTEM;
  });

  const [systemTheme, setSystemTheme] = useState(() => {
    // Detect initial system theme
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? THEME_OPTIONS.DARK
      : THEME_OPTIONS.LIGHT;
  });

  // Get the actual theme being applied
  const activeTheme = themePreference === THEME_OPTIONS.SYSTEM ? systemTheme : themePreference;

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e) => {
      setSystemTheme(e.matches ? THEME_OPTIONS.DARK : THEME_OPTIONS.LIGHT);
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  // Apply theme to document root
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove('theme-light', 'theme-dark');
    
    // Add current theme class
    root.classList.add(`theme-${activeTheme}`);
    
    // Set CSS custom properties for the theme
    if (activeTheme === THEME_OPTIONS.DARK) {
      root.style.setProperty('--color-background', '#121212');
      root.style.setProperty('--color-surface', '#1e1e1e');
      root.style.setProperty('--color-surface-variant', '#2d2d2d');
      root.style.setProperty('--color-primary', '#bb86fc');
      root.style.setProperty('--color-primary-variant', '#985eff');
      root.style.setProperty('--color-secondary', '#03dac6');
      root.style.setProperty('--color-text-primary', '#ffffff');
      root.style.setProperty('--color-text-secondary', '#b3b3b3');
      root.style.setProperty('--color-text-disabled', '#666666');
      root.style.setProperty('--color-border', '#404040');
      root.style.setProperty('--color-border-light', '#2d2d2d');
      root.style.setProperty('--color-error', '#cf6679');
      root.style.setProperty('--color-success', '#4caf50');
      root.style.setProperty('--color-warning', '#ff9800');
      root.style.setProperty('--shadow-elevation-1', '0 1px 3px rgba(0, 0, 0, 0.4)');
      root.style.setProperty('--shadow-elevation-2', '0 2px 6px rgba(0, 0, 0, 0.4)');
      root.style.setProperty('--shadow-elevation-3', '0 4px 12px rgba(0, 0, 0, 0.4)');
    } else {
      root.style.setProperty('--color-background', '#ffffff');
      root.style.setProperty('--color-surface', '#f8f9fa');
      root.style.setProperty('--color-surface-variant', '#f0f2f5');
      root.style.setProperty('--color-primary', '#6200ea');
      root.style.setProperty('--color-primary-variant', '#3700b3');
      root.style.setProperty('--color-secondary', '#018786');
      root.style.setProperty('--color-text-primary', '#000000');
      root.style.setProperty('--color-text-secondary', '#5f6368');
      root.style.setProperty('--color-text-disabled', '#9aa0a6');
      root.style.setProperty('--color-border', '#dadce0');
      root.style.setProperty('--color-border-light', '#e8eaed');
      root.style.setProperty('--color-error', '#d93025');
      root.style.setProperty('--color-success', '#2e7d32');
      root.style.setProperty('--color-warning', '#f57c00');
      root.style.setProperty('--shadow-elevation-1', '0 1px 3px rgba(0, 0, 0, 0.12)');
      root.style.setProperty('--shadow-elevation-2', '0 2px 6px rgba(0, 0, 0, 0.16)');
      root.style.setProperty('--shadow-elevation-3', '0 4px 12px rgba(0, 0, 0, 0.15)');
    }

    // Add transition for smooth theme changes
    root.style.setProperty('--theme-transition', 'background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease');
  }, [activeTheme]);

  const setTheme = (newTheme) => {
    if (!Object.values(THEME_OPTIONS).includes(newTheme)) {
      console.warn(`Invalid theme option: ${newTheme}`);
      return;
    }
    
    setThemePreference(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  };

  const toggleTheme = () => {
    if (themePreference === THEME_OPTIONS.SYSTEM) {
      setTheme(systemTheme === THEME_OPTIONS.DARK ? THEME_OPTIONS.LIGHT : THEME_OPTIONS.DARK);
    } else {
      setTheme(activeTheme === THEME_OPTIONS.DARK ? THEME_OPTIONS.LIGHT : THEME_OPTIONS.DARK);
    }
  };

  const value = {
    themePreference,
    activeTheme,
    systemTheme,
    setTheme,
    toggleTheme,
    isDark: activeTheme === THEME_OPTIONS.DARK,
    isLight: activeTheme === THEME_OPTIONS.LIGHT,
    isSystemDefault: themePreference === THEME_OPTIONS.SYSTEM
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;