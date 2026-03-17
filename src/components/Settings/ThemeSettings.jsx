import React, { useState, useEffect, createContext, useContext } from 'react';
import './ThemeSettings.css';

// Theme Context
const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Theme Provider Component
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('system');
  const [resolvedTheme, setResolvedTheme] = useState('light');

  // Get system theme preference
  const getSystemTheme = () => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  // Apply theme to document
  const applyTheme = (themeToApply) => {
    document.documentElement.setAttribute('data-theme', themeToApply);
    setResolvedTheme(themeToApply);
  };

  // Initialize theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'system';
    setTheme(savedTheme);
    
    const themeToApply = savedTheme === 'system' ? getSystemTheme() : savedTheme;
    applyTheme(themeToApply);
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e) => {
      if (theme === 'system') {
        const newSystemTheme = e.matches ? 'dark' : 'light';
        applyTheme(newSystemTheme);
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [theme]);

  // Update theme
  const updateTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    const themeToApply = newTheme === 'system' ? getSystemTheme() : newTheme;
    applyTheme(themeToApply);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, updateTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Theme Settings Component
const ThemeSettings = () => {
  const { theme, updateTheme } = useTheme();

  const themeOptions = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
    { value: 'system', label: 'System Default', icon: '💻' }
  ];

  const handleThemeChange = (selectedTheme) => {
    updateTheme(selectedTheme);
  };

  return (
    <div className="theme-settings">
      <div className="theme-settings__header">
        <h3 className="theme-settings__title">Appearance</h3>
        <p className="theme-settings__description">
          Choose how the app looks, or sync with your system and automatically switch between day and night themes.
        </p>
      </div>
      
      <div className="theme-settings__options">
        {themeOptions.map((option) => (
          <button
            key={option.value}
            className={`theme-option ${theme === option.value ? 'theme-option--active' : ''}`}
            onClick={() => handleThemeChange(option.value)}
            aria-pressed={theme === option.value}
            aria-describedby={`theme-${option.value}-description`}
          >
            <div className="theme-option__preview">
              <div className="theme-option__icon">{option.icon}</div>
              <div className={`theme-option__sample theme-option__sample--${option.value}`}>
                <div className="theme-option__sample-header"></div>
                <div className="theme-option__sample-content">
                  <div className="theme-option__sample-line theme-option__sample-line--primary"></div>
                  <div className="theme-option__sample-line theme-option__sample-line--secondary"></div>
                </div>
              </div>
            </div>
            <div className="theme-option__info">
              <span className="theme-option__label">{option.label}</span>
              {option.value === 'system' && (
                <span className="theme-option__subtitle">Matches system setting</span>
              )}
            </div>
            <div className="theme-option__indicator">
              {theme === option.value && (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ThemeSettings;