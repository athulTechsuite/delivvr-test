import { useState, useEffect, useContext, createContext } from 'react';

// Theme context
const ThemeContext = createContext();

// Theme provider component
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('system');
  const [resolvedTheme, setResolvedTheme] = useState('light');

  // Detect system theme preference
  const getSystemTheme = () => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  };

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
      setTheme(savedTheme);
    } else {
      setTheme('system');
    }
  }, []);

  // Update resolved theme when theme or system preference changes
  useEffect(() => {
    const updateResolvedTheme = () => {
      const newResolvedTheme = theme === 'system' ? getSystemTheme() : theme;
      setResolvedTheme(newResolvedTheme);
      
      // Apply theme to document
      document.documentElement.setAttribute('data-theme', newResolvedTheme);
      
      // Update CSS custom properties
      const root = document.documentElement;
      if (newResolvedTheme === 'dark') {
        root.style.setProperty('--color-background', '#0d1117');
        root.style.setProperty('--color-background-secondary', '#161b22');
        root.style.setProperty('--color-text-primary', '#e6edf3');
        root.style.setProperty('--color-text-secondary', '#8d96a0');
        root.style.setProperty('--color-border', '#30363d');
        root.style.setProperty('--color-border-secondary', '#21262d');
        root.style.setProperty('--color-accent', '#1f6feb');
        root.style.setProperty('--color-accent-hover', '#388bfd');
        root.style.setProperty('--color-success', '#28a745');
        root.style.setProperty('--color-warning', '#ffc107');
        root.style.setProperty('--color-error', '#dc3545');
        root.style.setProperty('--shadow-sm', '0 1px 3px rgba(0, 0, 0, 0.5)');
        root.style.setProperty('--shadow-md', '0 4px 6px rgba(0, 0, 0, 0.5)');
        root.style.setProperty('--shadow-lg', '0 10px 25px rgba(0, 0, 0, 0.6)');
      } else {
        root.style.setProperty('--color-background', '#ffffff');
        root.style.setProperty('--color-background-secondary', '#f6f8fa');
        root.style.setProperty('--color-text-primary', '#24292f');
        root.style.setProperty('--color-text-secondary', '#656d76');
        root.style.setProperty('--color-border', '#d0d7de');
        root.style.setProperty('--color-border-secondary', '#eaeef2');
        root.style.setProperty('--color-accent', '#0969da');
        root.style.setProperty('--color-accent-hover', '#0860ca');
        root.style.setProperty('--color-success', '#1a7f37');
        root.style.setProperty('--color-warning', '#d1242f');
        root.style.setProperty('--color-error', '#cf222e');
        root.style.setProperty('--shadow-sm', '0 1px 3px rgba(0, 0, 0, 0.1)');
        root.style.setProperty('--shadow-md', '0 4px 6px rgba(0, 0, 0, 0.1)');
        root.style.setProperty('--shadow-lg', '0 10px 25px rgba(0, 0, 0, 0.15)');
      }
    };

    updateResolvedTheme();

    // Listen for system theme changes
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', updateResolvedTheme);
      
      return () => {
        mediaQuery.removeEventListener('change', updateResolvedTheme);
      };
    }
  }, [theme]);

  // Toggle between themes
  const toggleTheme = () => {
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // Set specific theme
  const setThemeMode = (newTheme) => {
    if (['light', 'dark', 'system'].includes(newTheme)) {
      setTheme(newTheme);
      localStorage.setItem('theme', newTheme);
    }
  };

  const value = {
    theme,
    resolvedTheme,
    toggleTheme,
    setTheme: setThemeMode,
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

// Custom hook to use theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
};

// Hook for components that need theme-aware styles
export const useThemeStyles = () => {
  const { resolvedTheme } = useTheme();
  
  const getThemeClass = (baseClass, darkClass = null, lightClass = null) => {
    let classes = [baseClass];
    
    if (resolvedTheme === 'dark' && darkClass) {
      classes.push(darkClass);
    } else if (resolvedTheme === 'light' && lightClass) {
      classes.push(lightClass);
    }
    
    return classes.join(' ');
  };
  
  const getThemeValue = (lightValue, darkValue) => {
    return resolvedTheme === 'dark' ? darkValue : lightValue;
  };
  
  return {
    getThemeClass,
    getThemeValue,
    theme: resolvedTheme
  };
};

export default useTheme;