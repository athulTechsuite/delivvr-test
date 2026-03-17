import React, { createContext, useContext, useEffect, useState } from 'react';

// Define theme constants for validation
const THEME_VALUES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

const VALID_THEMES = Object.values(THEME_VALUES);

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(THEME_VALUES.SYSTEM);
  const [resolvedTheme, setResolvedTheme] = useState(THEME_VALUES.LIGHT);

  // Get system theme preference
  const getSystemTheme = () => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEME_VALUES.DARK : THEME_VALUES.LIGHT;
    }
    return THEME_VALUES.LIGHT;
  };

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme && VALID_THEMES.includes(storedTheme)) {
      setTheme(storedTheme);
    }
  }, []);

  // Update resolved theme when theme changes or system preference changes
  useEffect(() => {
    let currentTheme = theme;
    
    if (theme === THEME_VALUES.SYSTEM) {
      currentTheme = getSystemTheme();
    }

    setResolvedTheme(currentTheme);
    
    // Apply theme to document root
    document.documentElement.classList.remove(THEME_VALUES.LIGHT, THEME_VALUES.DARK);
    document.documentElement.classList.add(currentTheme);
    
    // Set CSS custom property for theme
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    let isCleanedUp = false;
    
    const handleChange = () => {
      if (isCleanedUp) return;
      
      if (theme === THEME_VALUES.SYSTEM) {
        const systemTheme = getSystemTheme();
        setResolvedTheme(systemTheme);
        document.documentElement.classList.remove(THEME_VALUES.LIGHT, THEME_VALUES.DARK);
        document.documentElement.classList.add(systemTheme);
        document.documentElement.setAttribute('data-theme', systemTheme);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      isCleanedUp = true;
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme]);

  const setThemePreference = (newTheme) => {
    if (!VALID_THEMES.includes(newTheme)) {
      console.warn(`Invalid theme: ${newTheme}. Valid options: ${VALID_THEMES.join(', ')}`);
      return;
    }
    
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const toggleTheme = () => {
    const newTheme = resolvedTheme === THEME_VALUES.LIGHT ? THEME_VALUES.DARK : THEME_VALUES.LIGHT;
    setThemePreference(newTheme);
  };

  const value = {
    theme, // Current theme setting (light, dark, or system)
    resolvedTheme, // Actual theme being used (light or dark)
    setTheme: setThemePreference,
    toggleTheme,
    isSystemTheme: theme === THEME_VALUES.SYSTEM,
    isDarkMode: resolvedTheme === THEME_VALUES.DARK,
    isLightMode: resolvedTheme === THEME_VALUES.LIGHT
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;