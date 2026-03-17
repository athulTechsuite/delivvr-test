import React, { createContext, useContext, useEffect, useState } from 'react';
import './ThemeToggle.css';

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

  // Get system preference
  const getSystemPreference = () => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  // Initialize theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'system';
    setTheme(savedTheme);
    
    const resolved = savedTheme === 'system' ? getSystemPreference() : savedTheme;
    setResolvedTheme(resolved);
    
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', resolved);
  }, []);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e) => {
      if (theme === 'system') {
        const newResolvedTheme = e.matches ? 'dark' : 'light';
        setResolvedTheme(newResolvedTheme);
        document.documentElement.setAttribute('data-theme', newResolvedTheme);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const changeTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    const resolved = newTheme === 'system' ? getSystemPreference() : newTheme;
    setResolvedTheme(resolved);
    
    // Apply theme with smooth transition
    document.documentElement.style.setProperty('--theme-transition', 'all 0.3s ease');
    document.documentElement.setAttribute('data-theme', resolved);
    
    // Remove transition after it completes to avoid interfering with other animations
    setTimeout(() => {
      document.documentElement.style.removeProperty('--theme-transition');
    }, 300);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Theme Toggle Component
const ThemeToggle = () => {
  const { theme, resolvedTheme, changeTheme } = useTheme();

  const themeOptions = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
    { value: 'system', label: 'System', icon: '💻' }
  ];

  return (
    <div className="theme-toggle-container">
      <h3 className="theme-toggle-title">Theme Preference</h3>
      <p className="theme-toggle-description">
        Choose how the app looks. Select a single theme, or sync with your system and automatically switch between day and night themes.
      </p>
      
      <div className="theme-toggle-options">
        {themeOptions.map((option) => (
          <button
            key={option.value}
            className={`theme-toggle-option ${theme === option.value ? 'active' : ''}`}
            onClick={() => changeTheme(option.value)}
            aria-pressed={theme === option.value}
            aria-label={`Switch to ${option.label} theme`}
          >
            <span className="theme-toggle-icon" aria-hidden="true">
              {option.icon}
            </span>
            <span className="theme-toggle-label">{option.label}</span>
            {option.value === 'system' && (
              <span className="theme-toggle-sublabel">
                Currently: {resolvedTheme}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="theme-preview">
        <div className="theme-preview-item">
          <div className="theme-preview-header"></div>
          <div className="theme-preview-content">
            <div className="theme-preview-text"></div>
            <div className="theme-preview-text short"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeToggle;