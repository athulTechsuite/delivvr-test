import { useState, useEffect, useCallback } from 'react';

const THEME_KEY = 'app-theme-preference';
const THEME_OPTIONS = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

const useTheme = () => {
  // Get initial theme from localStorage or default to system
  const getInitialTheme = () => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      return stored && Object.values(THEME_OPTIONS).includes(stored) 
        ? stored 
        : THEME_OPTIONS.SYSTEM;
    } catch (error) {
      console.warn('Failed to read theme preference from localStorage:', error);
      return THEME_OPTIONS.SYSTEM;
    }
  };

  const [themePreference, setThemePreference] = useState(getInitialTheme);
  const [systemTheme, setSystemTheme] = useState(() => 
    window.matchMedia('(prefers-color-scheme: dark)').matches 
      ? THEME_OPTIONS.DARK 
      : THEME_OPTIONS.LIGHT
  );

  // Determine the actual theme to apply
  const actualTheme = themePreference === THEME_OPTIONS.SYSTEM 
    ? systemTheme 
    : themePreference;

  // Apply theme to document root
  const applyTheme = useCallback((theme) => {
    const root = document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove('theme-light', 'theme-dark');
    
    // Add new theme class
    root.classList.add(`theme-${theme}`);
    
    // Set data attribute for CSS targeting
    root.setAttribute('data-theme', theme);
    
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const color = theme === THEME_OPTIONS.DARK ? '#1a1a1a' : '#ffffff';
      metaThemeColor.setAttribute('content', color);
    }
  }, []);

  // Handle system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e) => {
      setSystemTheme(e.matches ? THEME_OPTIONS.DARK : THEME_OPTIONS.LIGHT);
    };

    // Add listener for system theme changes
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  // Apply theme whenever actualTheme changes
  useEffect(() => {
    applyTheme(actualTheme);
  }, [actualTheme, applyTheme]);

  // Persist theme preference
  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, themePreference);
    } catch (error) {
      console.warn('Failed to save theme preference to localStorage:', error);
    }
  }, [themePreference]);

  // Theme setter function
  const setTheme = useCallback((newTheme) => {
    if (Object.values(THEME_OPTIONS).includes(newTheme)) {
      setThemePreference(newTheme);
    } else {
      console.warn(`Invalid theme option: ${newTheme}`);
    }
  }, []);

  // Toggle between light and dark (ignoring system)
  const toggleTheme = useCallback(() => {
    const newTheme = actualTheme === THEME_OPTIONS.LIGHT 
      ? THEME_OPTIONS.DARK 
      : THEME_OPTIONS.LIGHT;
    setTheme(newTheme);
  }, [actualTheme, setTheme]);

  // Check if current theme is dark
  const isDark = actualTheme === THEME_OPTIONS.DARK;

  // Check if using system preference
  const isSystem = themePreference === THEME_OPTIONS.SYSTEM;

  return {
    // Current theme values
    theme: actualTheme,
    themePreference,
    systemTheme,
    isDark,
    isSystem,
    
    // Theme control functions
    setTheme,
    toggleTheme,
    
    // Theme options constant
    THEME_OPTIONS
  };
};

export default useTheme;