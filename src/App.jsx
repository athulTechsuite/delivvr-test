import React, { useEffect } from 'react';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { SettingsProvider } from './contexts/SettingsContext';
import AppRoutes from './components/AppRoutes';
import './styles/themes.css';
import './styles/global.css';
import './styles/accessibility.css';

// Theme-aware app wrapper component
function AppWrapper() {
  const { theme } = useTheme();

  useEffect(() => {
    // Apply theme class to document root for global theme inheritance
    document.documentElement.className = `theme-${theme}`;
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const themeColor = theme === 'dark' ? '#1a1a1a' : '#ffffff';
      metaThemeColor.setAttribute('content', themeColor);
    }

    // Update favicon for theme adaptation
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon) {
      const faviconPath = theme === 'dark' 
        ? '/favicon-dark.ico' 
        : '/favicon-light.ico';
      favicon.href = faviconPath;
    }

    // Ensure proper ARIA attributes for theme
    document.body.setAttribute('aria-label', `Application in ${theme} theme`);
    
    // Force repaint to ensure theme changes are applied immediately
    document.body.style.display = 'none';
    document.body.offsetHeight; // Trigger reflow
    document.body.style.display = '';

  }, [theme]);

  // Add loading overlay component that respects theme
  const LoadingOverlay = ({ isVisible }) => (
    <div 
      className={`loading-overlay ${isVisible ? 'visible' : ''} theme-${theme}`}
      role="status" 
      aria-live="polite"
      aria-label="Loading content"
    >
      <div className="loading-spinner" aria-hidden="true"></div>
      <span className="sr-only">Loading...</span>
    </div>
  );

  return (
    <div 
      className={`app theme-${theme}`}
      data-theme={theme}
      role="main"
      aria-label="Main application"
    >
      <AppRoutes />
      <LoadingOverlay isVisible={false} />
      {/* High contrast mode indicator for accessibility */}
      <div 
        className="accessibility-indicator"
        aria-live="polite"
        aria-atomic="true"
        role="status"
      >
        <span className="sr-only">
          Current theme: {theme}. Press Alt+T to toggle theme.
        </span>
      </div>
    </div>
  );
}

function App() {
  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      document.documentElement.classList.add('reduce-motion');
    }

    // Check for high contrast preference
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
    if (prefersHighContrast) {
      document.documentElement.classList.add('high-contrast');
    }

    // Add keyboard navigation support for theme switching
    const handleKeyDown = (event) => {
      if (event.altKey && event.key === 't') {
        event.preventDefault();
        // Theme toggle will be handled by ThemeContext
        const themeToggleEvent = new CustomEvent('toggleTheme');
        window.dispatchEvent(themeToggleEvent);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <SettingsProvider>
      <ThemeProvider>
        <AppWrapper />
      </ThemeProvider>
    </SettingsProvider>
  );
}

export default App;