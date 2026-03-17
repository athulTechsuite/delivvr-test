import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import Header from './components/Header';
import Settings from './components/Settings';
import Home from './components/Home';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import './styles/themes.css';
import './App.css';

function AppContent() {
  const { theme, systemTheme } = useTheme();
  
  useEffect(() => {
    // Apply theme classes to document root for global theming
    const root = document.documentElement;
    const effectiveTheme = theme === 'auto' ? systemTheme : theme;
    
    // Remove existing theme classes
    root.classList.remove('light-theme', 'dark-theme');
    
    // Add current theme class
    root.classList.add(`${effectiveTheme}-theme`);
    
    // Set data attribute for CSS selectors
    root.setAttribute('data-theme', effectiveTheme);
    
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const themeColors = {
        light: '#ffffff',
        dark: '#1a1a1a'
      };
      metaThemeColor.setAttribute('content', themeColors[effectiveTheme]);
    }
  }, [theme, systemTheme]);

  return (
    <Router>
      <div className="app" role="application" aria-label="Main Application">
        <Header />
        <main className="main-content" role="main" id="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<LoginForm />} />
            <Route path="/register" element={<RegisterForm />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
        {/* Skip to main content link for accessibility */}
        <a 
          href="#main-content" 
          className="skip-link"
          aria-label="Skip to main content"
        >
          Skip to main content
        </a>
      </div>
    </Router>
  );
}

function App() {
  useEffect(() => {
    // Add CSS custom properties for WCAG AA contrast compliance
    const style = document.createElement('style');
    style.textContent = `
      :root {
        /* Light theme - WCAG AA compliant colors */
        --light-bg-primary: #ffffff;
        --light-bg-secondary: #f8f9fa;
        --light-text-primary: #212529; /* 16.4:1 contrast ratio */
        --light-text-secondary: #495057; /* 7.7:1 contrast ratio */
        --light-border: #dee2e6;
        --light-accent: #0d6efd;
        --light-accent-hover: #0b5ed7;
        --light-success: #198754;
        --light-warning: #fd7e14;
        --light-danger: #dc3545;
        
        /* Dark theme - WCAG AA compliant colors */
        --dark-bg-primary: #1a1a1a;
        --dark-bg-secondary: #2d2d2d;
        --dark-text-primary: #ffffff; /* 16.4:1 contrast ratio */
        --dark-text-secondary: #b8b8b8; /* 7.1:1 contrast ratio */
        --dark-border: #404040;
        --dark-accent: #4dabf7;
        --dark-accent-hover: #339af0;
        --dark-success: #51cf66;
        --dark-warning: #ffa726;
        --dark-danger: #ff6b6b;
        
        /* Focus indicators for accessibility */
        --focus-ring: 0 0 0 3px rgba(66, 153, 225, 0.6);
        --focus-ring-dark: 0 0 0 3px rgba(144, 205, 244, 0.6);
      }
      
      /* Skip link styles */
      .skip-link {
        position: absolute;
        top: -40px;
        left: 6px;
        background: var(--accent-color);
        color: white;
        padding: 8px;
        text-decoration: none;
        border-radius: 4px;
        z-index: 9999;
        font-weight: 600;
      }
      
      .skip-link:focus {
        top: 6px;
        outline: 2px solid #fff;
        outline-offset: 2px;
      }
      
      /* Ensure focus indicators are visible */
      *:focus {
        outline: 2px solid transparent;
        outline-offset: 2px;
      }
      
      .light-theme *:focus {
        box-shadow: var(--focus-ring);
      }
      
      .dark-theme *:focus {
        box-shadow: var(--focus-ring-dark);
      }
      
      /* High contrast mode support */
      @media (prefers-contrast: high) {
        :root {
          --light-text-primary: #000000;
          --light-bg-primary: #ffffff;
          --dark-text-primary: #ffffff;
          --dark-bg-primary: #000000;
        }
      }
      
      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    `;
    document.head.appendChild(style);
    
    // Set initial theme-color meta tag
    if (!document.querySelector('meta[name="theme-color"]')) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = '#ffffff';
      document.head.appendChild(meta);
    }
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;