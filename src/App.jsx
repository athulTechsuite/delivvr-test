import React, { createContext, useContext, useState, useEffect } from 'react';
import './App.css';

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
const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('system');
  const [resolvedTheme, setResolvedTheme] = useState('light');

  // Get system theme preference
  const getSystemTheme = () => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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

  // Update resolved theme when theme changes or system preference changes
  useEffect(() => {
    const updateResolvedTheme = () => {
      let newResolvedTheme;
      if (theme === 'system') {
        newResolvedTheme = getSystemTheme();
      } else {
        newResolvedTheme = theme;
      }
      setResolvedTheme(newResolvedTheme);
    };

    updateResolvedTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        updateResolvedTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.className = `theme-${resolvedTheme}`;
  }, [resolvedTheme]);

  // Toggle theme function
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
    isLight: resolvedTheme === 'light',
    isDark: resolvedTheme === 'dark',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Theme Toggle Button Component
const ThemeToggle = ({ className = '' }) => {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const handleThemeChange = (event) => {
    setTheme(event.target.value);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const select = event.target.querySelector('select') || event.target;
      select.focus();
    }
  };

  return (
    <div className={`theme-toggle ${className}`}>
      <label htmlFor="theme-select" className="theme-toggle__label">
        Theme:
      </label>
      <select
        id="theme-select"
        value={theme}
        onChange={handleThemeChange}
        onKeyDown={handleKeyDown}
        className="theme-toggle__select"
        aria-label="Select theme preference"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
      <span className="theme-toggle__current" aria-live="polite">
        Current: {resolvedTheme}
      </span>
    </div>
  );
};

// Settings Component
const Settings = () => {
  const { theme, resolvedTheme } = useTheme();

  return (
    <div className="settings">
      <h2 className="settings__title">Settings</h2>
      <div className="settings__section">
        <h3 className="settings__section-title">Appearance</h3>
        <div className="settings__option">
          <ThemeToggle />
          <p className="settings__description">
            Choose your preferred theme. System will match your device's theme preference.
            Currently using: <strong>{resolvedTheme}</strong> theme
            {theme === 'system' && ' (auto)'}
          </p>
        </div>
      </div>
    </div>
  );
};

// Sample Components to demonstrate theming
const Header = () => {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <header className="header">
      <div className="header__container">
        <h1 className="header__title">Theme Demo App</h1>
        <button
          onClick={toggleTheme}
          className="header__theme-btn"
          aria-label={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} theme`}
        >
          {resolvedTheme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
    </header>
  );
};

const MainContent = () => {
  const [showSettings, setShowSettings] = useState(false);
  const { resolvedTheme } = useTheme();

  return (
    <main className="main">
      <div className="main__container">
        <section className="hero">
          <h2 className="hero__title">Welcome to the Theme System</h2>
          <p className="hero__description">
            This application demonstrates a complete dark and light theme implementation
            with system preference detection and persistent storage.
          </p>
          <p className="hero__status">
            Currently using: <span className="theme-badge">{resolvedTheme}</span> theme
          </p>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="hero__settings-btn"
          >
            {showSettings ? 'Hide' : 'Show'} Settings
          </button>
        </section>

        {showSettings && (
          <section className="settings-section">
            <Settings />
          </section>
        )}

        <section className="demo-components">
          <h3>Demo Components</h3>
          <div className="card">
            <h4 className="card__title">Sample Card</h4>
            <p className="card__content">
              This card demonstrates how components adapt to different themes with
              appropriate colors, shadows, and contrast ratios.
            </p>
            <button className="card__button">Sample Button</button>
          </div>
        </section>
      </div>
    </main>
  );
};

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer__container">
        <p className="footer__text">
          Theme System Demo • Built with React & CSS Custom Properties
        </p>
      </div>
    </footer>
  );
};

// Main App Component
const App = () => {
  return (
    <ThemeProvider>
      <div className="app">
        <Header />
        <MainContent />
        <Footer />
      </div>
    </ThemeProvider>
  );
};

export default App;