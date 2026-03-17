import React, { useState } from 'react';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import './App.css';

// Theme Toggle Button Component with improved accessibility
const ThemeToggle = ({ className = '', showSystemOption = false }) => {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const handleThemeChange = (event) => {
    setTheme(event.target.value);
  };

  const handleKeyDown = (event) => {
    // Enhanced keyboard navigation
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const currentTheme = theme;
      const themes = showSystemOption ? ['light', 'dark', 'system'] : ['light', 'dark'];
      const currentIndex = themes.indexOf(currentTheme);
      let newIndex;
      
      if (event.key === 'ArrowUp') {
        newIndex = currentIndex > 0 ? currentIndex - 1 : themes.length - 1;
      } else {
        newIndex = currentIndex < themes.length - 1 ? currentIndex + 1 : 0;
      }
      
      setTheme(themes[newIndex]);
    }
  };

  return (
    <div className={`theme-toggle ${className}`} role="group" aria-labelledby="theme-toggle-label">
      <span id="theme-toggle-label" className="theme-toggle__label">
        Theme Selection:
      </span>
      <select
        id="theme-select"
        value={theme}
        onChange={handleThemeChange}
        onKeyDown={handleKeyDown}
        className="theme-toggle__select"
        aria-label="Select theme preference"
        aria-describedby="theme-description"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        {showSystemOption && <option value="system">System</option>}
      </select>
      <span 
        id="theme-description" 
        className="theme-toggle__current" 
        aria-live="polite"
        aria-atomic="true"
      >
        Active theme: {resolvedTheme} {theme === 'system' ? '(system preference)' : ''}
      </span>
    </div>
  );
};

// Settings Component - PRD compliant (Light/Dark only)
const Settings = () => {
  const { resolvedTheme } = useTheme();

  return (
    <div className="settings" role="region" aria-labelledby="settings-title">
      <h2 id="settings-title" className="settings__title">Settings</h2>
      <div className="settings__section">
        <h3 className="settings__section-title">Appearance</h3>
        <div className="settings__option">
          {/* PRD requirement: Only Light and Dark options */}
          <ThemeToggle showSystemOption={false} />
          <p className="settings__description">
            Choose between Light and Dark themes. 
            Currently active: <strong>{resolvedTheme}</strong> theme
          </p>
        </div>
      </div>
    </div>
  );
};

// Icon component with theme variants for accessibility compliance
const ThemedIcon = ({ icon, alt, className = '' }) => {
  const { resolvedTheme } = useTheme();
  
  // Icon variants for different themes
  const iconVariants = {
    light: {
      sun: '☀️',
      moon: '🌙',
      settings: '⚙️',
      home: '🏠',
      user: '👤'
    },
    dark: {
      sun: '🌞',
      moon: '🌚',
      settings: '⚙️',
      home: '🏠',
      user: '👥'
    }
  };

  const iconContent = iconVariants[resolvedTheme]?.[icon] || iconVariants.light[icon] || icon;

  return (
    <span 
      className={`themed-icon ${className}`} 
      role="img" 
      aria-label={alt}
      data-theme={resolvedTheme}
    >
      {iconContent}
    </span>
  );
};

// Sample Components with complete theme integration
const Header = () => {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <header className="header" role="banner">
      <div className="header__container">
        <h1 className="header__title">
          <ThemedIcon icon="home" alt="Home" className="header__icon" />
          Theme Demo App
        </h1>
        <button
          onClick={toggleTheme}
          className="header__theme-btn"
          aria-label={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} theme`}
          aria-pressed={resolvedTheme === 'dark'}
        >
          <ThemedIcon 
            icon={resolvedTheme === 'light' ? 'moon' : 'sun'} 
            alt={`${resolvedTheme === 'light' ? 'Dark' : 'Light'} theme`}
          />
        </button>
      </div>
    </header>
  );
};

const MainContent = () => {
  const [showSettings, setShowSettings] = useState(false);
  const { resolvedTheme } = useTheme();

  return (
    <main className="main" role="main">
      <div className="main__container">
        <section className="hero">
          <h2 className="hero__title">Welcome to the Theme System</h2>
          <p className="hero__description">
            This application demonstrates a complete dark and light theme implementation
            with WCAG AA compliant contrast ratios and accessible navigation.
          </p>
          <p className="hero__status">
            Currently using: 
            <span 
              className={`theme-badge theme-badge--${resolvedTheme}`}
              aria-label={`${resolvedTheme} theme active`}
            >
              {resolvedTheme}
            </span> theme
          </p>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="hero__settings-btn"
            aria-expanded={showSettings}
            aria-controls="settings-section"
          >
            <ThemedIcon icon="settings" alt="Settings" />
            {showSettings ? 'Hide' : 'Show'} Settings
          </button>
        </section>

        {showSettings && (
          <section 
            id="settings-section" 
            className="settings-section"
            aria-live="polite"
          >
            <Settings />
          </section>
        )}

        <section className="demo-components" aria-labelledby="demo-title">
          <h3 id="demo-title">Demo Components</h3>
          <div className="card">
            <h4 className="card__title">
              <ThemedIcon icon="user" alt="User" className="card__icon" />
              Sample Card
            </h4>
            <p className="card__content">
              This card demonstrates how components adapt to different themes with
              WCAG AA compliant contrast ratios (4.5:1 minimum) for accessibility.
            </p>
            <button className="card__button">
              Sample Button
            </button>
          </div>
          
          {/* Additional themed components */}
          <div className="feature-grid">
            <div className="feature-card">
              <h5 className="feature-card__title">Accessibility First</h5>
              <p className="feature-card__text">
                High contrast ratios maintained across all themes
              </p>
            </div>
            <div className="feature-card">
              <h5 className="feature-card__title">Keyboard Navigation</h5>
              <p className="feature-card__text">
                Full keyboard accessibility with proper focus management
              </p>
            </div>
            <div className="feature-card">
              <h5 className="feature-card__title">Theme Variants</h5>
              <p className="feature-card__text">
                Icons and images adapt automatically to the selected theme
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

const Footer = () => {
  const { resolvedTheme } = useTheme();
  
  return (
    <footer className="footer" role="contentinfo">
      <div className="footer__container">
        <p className="footer__text">
          Theme System Demo • Built with React & CSS Custom Properties
        </p>
        <p className="footer__accessibility">
          WCAG AA Compliant • {resolvedTheme === 'light' ? 'Light' : 'Dark'} Theme Active
        </p>
      </div>
    </footer>
  );
};

// Main App Component
const App = () => {
  return (
    <ThemeProvider>
      <div className="app" data-testid="app">
        <Header />
        <MainContent />
        <Footer />
      </div>
    </ThemeProvider>
  );
};

export default App;