import { useState, useEffect, useCallback } from 'react';

const THEME_STORAGE_KEY = 'app-theme';
const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

const getSystemTheme = () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEMES.DARK : THEMES.LIGHT;
  }
  return THEMES.LIGHT;
};

const getStoredTheme = () => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && Object.values(THEMES).includes(stored)) {
      return stored;
    }
  }
  return THEMES.SYSTEM;
};

const getEffectiveTheme = (themePreference) => {
  if (themePreference === THEMES.SYSTEM) {
    return getSystemTheme();
  }
  return themePreference;
};

const applyThemeToDOM = (theme) => {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const themeColors = {
        [THEMES.LIGHT]: '#ffffff',
        [THEMES.DARK]: '#1a1a1a'
      };
      metaThemeColor.setAttribute('content', themeColors[theme] || themeColors[THEMES.LIGHT]);
    }
  }
};

export const useTheme = () => {
  const [themePreference, setThemePreference] = useState(getStoredTheme);
  const [effectiveTheme, setEffectiveTheme] = useState(() => getEffectiveTheme(getStoredTheme()));

  // Handle system theme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e) => {
      if (themePreference === THEMES.SYSTEM) {
        const newTheme = e.matches ? THEMES.DARK : THEMES.LIGHT;
        setEffectiveTheme(newTheme);
        applyThemeToDOM(newTheme);
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [themePreference]);

  // Apply theme to DOM when effective theme changes
  useEffect(() => {
    applyThemeToDOM(effectiveTheme);
  }, [effectiveTheme]);

  const setTheme = useCallback((newTheme) => {
    if (!Object.values(THEMES).includes(newTheme)) {
      console.warn(`Invalid theme: ${newTheme}. Using system theme.`);
      newTheme = THEMES.SYSTEM;
    }

    setThemePreference(newTheme);
    
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    }

    // Update effective theme
    const effective = getEffectiveTheme(newTheme);
    setEffectiveTheme(effective);
    applyThemeToDOM(effective);
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = effectiveTheme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT;
    setTheme(newTheme);
  }, [effectiveTheme, setTheme]);

  const isDark = effectiveTheme === THEMES.DARK;
  const isLight = effectiveTheme === THEMES.LIGHT;
  const isSystem = themePreference === THEMES.SYSTEM;

  return {
    theme: effectiveTheme,
    themePreference,
    setTheme,
    toggleTheme,
    isDark,
    isLight,
    isSystem,
    themes: THEMES
  };
};

export default useTheme;