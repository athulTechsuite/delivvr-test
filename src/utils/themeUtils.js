// Theme utility functions for managing light/dark mode
export const THEME_TYPES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

export const STORAGE_KEY = 'app-theme-preference';

/**
 * Get the user's saved theme preference from localStorage
 * @returns {string} The saved theme preference or 'system' as default
 */
export const getSavedThemePreference = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && Object.values(THEME_TYPES).includes(saved) ? saved : THEME_TYPES.SYSTEM;
  } catch (error) {
    console.warn('Failed to read theme preference from localStorage:', error);
    return THEME_TYPES.SYSTEM;
  }
};

/**
 * Save the user's theme preference to localStorage
 * @param {string} theme - The theme to save
 */
export const saveThemePreference = (theme) => {
  try {
    if (Object.values(THEME_TYPES).includes(theme)) {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  } catch (error) {
    console.warn('Failed to save theme preference to localStorage:', error);
  }
};

/**
 * Get the system's preferred color scheme
 * @returns {string} 'dark' or 'light'
 */
export const getSystemTheme = () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches 
      ? THEME_TYPES.DARK 
      : THEME_TYPES.LIGHT;
  }
  return THEME_TYPES.LIGHT;
};

/**
 * Resolve the actual theme to apply based on user preference
 * @param {string} themePreference - The user's theme preference
 * @returns {string} 'dark' or 'light'
 */
export const resolveTheme = (themePreference) => {
  if (themePreference === THEME_TYPES.SYSTEM) {
    return getSystemTheme();
  }
  return themePreference;
};

/**
 * Apply theme to document root element
 * @param {string} theme - The theme to apply ('light' or 'dark')
 */
export const applyTheme = (theme) => {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    
    // Also add theme class for CSS selectors that prefer classes
    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(`theme-${theme}`);
  }
};

/**
 * Create a media query listener for system theme changes
 * @param {function} callback - Function to call when system theme changes
 * @returns {function} Cleanup function to remove the listener
 */
export const createSystemThemeListener = (callback) => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e) => {
      const systemTheme = e.matches ? THEME_TYPES.DARK : THEME_TYPES.LIGHT;
      callback(systemTheme);
    };
    
    // Use the newer addEventListener if available, fallback to addListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }
  
  return () => {}; // No-op cleanup function for server-side rendering
};

/**
 * Get theme display name for UI
 * @param {string} theme - Theme type
 * @returns {string} Display name
 */
export const getThemeDisplayName = (theme) => {
  const displayNames = {
    [THEME_TYPES.LIGHT]: 'Light',
    [THEME_TYPES.DARK]: 'Dark',
    [THEME_TYPES.SYSTEM]: 'System'
  };
  return displayNames[theme] || 'Unknown';
};

/**
 * Check if current theme is dark
 * @param {string} theme - Current resolved theme
 * @returns {boolean} True if dark theme
 */
export const isDarkTheme = (theme) => {
  return theme === THEME_TYPES.DARK;
};

/**
 * Get appropriate icon variant for current theme
 * @param {string} theme - Current resolved theme
 * @returns {string} Icon variant ('light' or 'dark')
 */
export const getIconVariant = (theme) => {
  return isDarkTheme(theme) ? 'light' : 'dark';
};