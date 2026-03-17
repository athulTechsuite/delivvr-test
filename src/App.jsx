import React, { createContext, useContext, useState, useEffect } from 'react';
import './styles/themes.css';

// Theme Context
const ThemeContext = createContext();

// Theme types
export const THEME_MODES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

// Theme Provider Component
export const ThemeProvider = ({ children }) => {
  const [themeMode, setThemeMode] = useState(() => {
    // Initialize from localStorage or default to system
    const savedTheme = localStorage.getItem('theme-preference');
    return savedTheme || THEME_MODES.SYSTEM;
  });

  const [actualTheme, setActualTheme] = useState('light');

  // Function to get system theme preference
  const getSystemTheme = () => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches 
      ? THEME_MODES.DARK 
      : THEME_MODES.LIGHT;
  };

  // Update actual theme based on mode
  useEffect(() => {
    let theme = themeMode;
    
    if (themeMode === THEME_MODES.SYSTEM) {
      theme = getSystemTheme();
    }
    
    setActualTheme(theme);
    
    // Apply theme to document root
    document.documentElement.setAttribute('data-theme', theme);
    
    // Persist theme preference
    localStorage.setItem('theme-preference', themeMode);
  }, [themeMode]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e) => {
      if (themeMode === THEME_MODES.SYSTEM) {
        const newTheme = e.matches ? THEME_MODES.DARK : THEME_MODES.LIGHT;
        setActualTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [themeMode]);

  const value = {
    themeMode,
    actualTheme,
    setTheme: setThemeMode,
    isSystemMode: themeMode === THEME_MODES.SYSTEM
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use theme
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Settings Component
const ThemeSettings = () => {
  const { themeMode, setTheme } = useTheme();

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
  };

  return (
    <div className="theme-settings">
      <h3>Theme Settings</h3>
      <div className="theme-options">
        <label className="theme-option">
          <input
            type="radio"
            name="theme"
            value={THEME_MODES.LIGHT}
            checked={themeMode === THEME_MODES.LIGHT}
            onChange={() => handleThemeChange(THEME_MODES.LIGHT)}
          />
          <span className="theme-label">Light</span>
        </label>
        
        <label className="theme-option">
          <input
            type="radio"
            name="theme"
            value={THEME_MODES.DARK}
            checked={themeMode === THEME_MODES.DARK}
            onChange={() => handleThemeChange(THEME_MODES.DARK)}
          />
          <span className="theme-label">Dark</span>
        </label>
        
        <label className="theme-option">
          <input
            type="radio"
            name="theme"
            value={THEME_MODES.SYSTEM}
            checked={themeMode === THEME_MODES.SYSTEM}
            onChange={() => handleThemeChange(THEME_MODES.SYSTEM)}
          />
          <span className="theme-label">System Default</span>
        </label>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const { actualTheme, themeMode, isSystemMode } = useTheme();

  return (
    <div className="app">
      <header className="app-header">
        <h1>My App</h1>
        <div className="theme-indicator">
          Current theme: {actualTheme}
          {isSystemMode && ' (System)'}
        </div>
      </header>
      
      <main className="app-main">
        <div className="content">
          <h2>Welcome to the App</h2>
          <p>This app supports light, dark, and system default themes.</p>
          <p>The theme changes are applied immediately and persist across sessions.</p>
          
          <div className="card">
            <h3>Sample Card</h3>
            <p>This card demonstrates how components adapt to different themes.</p>
            <button className="primary-button">Primary Button</button>
            <button className="secondary-button">Secondary Button</button>
          </div>
        </div>
        
        <aside className="sidebar">
          <ThemeSettings />
        </aside>
      </main>
    </div>
  );
};

// App with Theme Provider Wrapper
const AppWithTheme = () => {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
};

export default AppWithTheme;