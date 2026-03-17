/**
 * Theme utility functions for managing dark/light mode preferences
 */

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

const THEME_STORAGE_KEY = 'app-theme-preference';

/**
 * Gets the user's system theme preference
 * @returns {string} 'dark' or 'light'
 */
export const getSystemTheme = () => {
  if (typeof window === 'undefined') return THEMES.LIGHT;
  
  return window.matchMedia('(prefers-color-scheme: dark)').matches 
    ? THEMES.DARK 
    : THEMES.LIGHT;
};

/**
 * Gets the stored theme preference from localStorage
 * @returns {string} stored theme or null if not set
 */
export const getStoredTheme = () => {
  if (typeof window === 'undefined') return null;
  
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to read theme from localStorage:', error);
    return null;
  }
};

/**
 * Stores the theme preference in localStorage
 * @param {string} theme - Theme to store
 */
export const setStoredTheme = (theme) => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.warn('Failed to save theme to localStorage:', error);
  }
};

/**
 * Removes the theme preference from localStorage
 */
export const removeStoredTheme = () => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to remove theme from localStorage:', error);
  }
};

/**
 * Resolves the actual theme to apply based on user preference
 * @param {string} themePreference - User's theme preference (light/dark/system)
 * @returns {string} 'light' or 'dark'
 */
export const resolveTheme = (themePreference) => {
  if (themePreference === THEMES.SYSTEM || !themePreference) {
    return getSystemTheme();
  }
  
  return themePreference === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
};

/**
 * Gets the initial theme preference on app load
 * Priority: stored preference > system preference
 * @returns {string} theme preference
 */
export const getInitialTheme = () => {
  const storedTheme = getStoredTheme();
  if (storedTheme && Object.values(THEMES).includes(storedTheme)) {
    return storedTheme;
  }
  
  return THEMES.SYSTEM;
};

/**
 * Applies theme CSS custom properties to document root
 * @param {string} theme - 'light' or 'dark'
 */
export const applyTheme = (theme) => {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  const resolvedTheme = resolveTheme(theme);
  
  // Remove existing theme classes
  root.classList.remove('theme-light', 'theme-dark');
  
  // Add new theme class
  root.classList.add(`theme-${resolvedTheme}`);
  
  // Set data attribute for CSS selectors
  root.setAttribute('data-theme', resolvedTheme);
  
  // Update meta theme-color for mobile browsers
  updateMetaThemeColor(resolvedTheme);
};

/**
 * Updates the meta theme-color tag for mobile browser UI
 * @param {string} theme - 'light' or 'dark'
 */
const updateMetaThemeColor = (theme) => {
  if (typeof document === 'undefined') return;
  
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (!metaThemeColor) return;
  
  const themeColors = {
    light: '#ffffff',
    dark: '#1a1a1a'
  };
  
  metaThemeColor.setAttribute('content', themeColors[theme] || themeColors.light);
};

/**
 * Sets up a listener for system theme changes
 * @param {Function} callback - Function to call when system theme changes
 * @returns {Function} cleanup function to remove the listener
 */
export const setupSystemThemeListener = (callback) => {
  if (typeof window === 'undefined') return () => {};
  
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  const handleChange = (e) => {
    const newSystemTheme = e.matches ? THEMES.DARK : THEMES.LIGHT;
    callback(newSystemTheme);
  };
  
  // Use addEventListener if available (modern browsers)
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  } 
  // Fallback for older browsers
  else if (mediaQuery.addListener) {
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }
  
  return () => {};
};

/**
 * Validates if a theme value is valid
 * @param {string} theme - Theme to validate
 * @returns {boolean} true if valid theme
 */
export const isValidTheme = (theme) => {
  return Object.values(THEMES).includes(theme);
};

/**
 * Gets theme-specific CSS class names
 * @param {string} baseClass - Base CSS class name
 * @param {string} theme - Current theme
 * @returns {string} theme-aware class names
 */
export const getThemeClasses = (baseClass, theme = null) => {
  if (!theme) {
    return baseClass;
  }
  
  const resolvedTheme = resolveTheme(theme);
  return `${baseClass} ${baseClass}--${resolvedTheme}`;
};

/**
 * Debounce utility for theme transitions
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} debounced function
 */
export const debounceThemeChange = (func, delay = 150) => {
  let timeoutId;
  
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};