import React, { useContext } from 'react';
import { ThemeContext } from '../../contexts/ThemeContext';
import './ThemeToggle.css';

const ThemeToggle = ({ className = '', showLabel = true, size = 'medium' }) => {
  const { theme, toggleTheme, isSystemDefault } = useContext(ThemeContext);

  const handleToggle = () => {
    toggleTheme();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleTheme();
    }
  };

  const isDark = theme === 'dark';
  const toggleId = `theme-toggle-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`theme-toggle-container ${className}`}>
      {showLabel && (
        <label htmlFor={toggleId} className="theme-toggle-label">
          Theme
          {isSystemDefault && (
            <span className="theme-toggle-system-indicator" aria-label="Using system preference">
              (Auto)
            </span>
          )}
        </label>
      )}
      
      <div className="theme-toggle-wrapper">
        <button
          id={toggleId}
          type="button"
          role="switch"
          aria-checked={isDark}
          aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
          className={`theme-toggle ${size} ${isDark ? 'dark' : 'light'}`}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
        >
          <span className="theme-toggle-track">
            <span className="theme-toggle-thumb">
              <span className="theme-toggle-icon">
                {isDark ? (
                  // Moon icon for dark theme
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                  </svg>
                ) : (
                  // Sun icon for light theme
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                  </svg>
                )}
              </span>
            </span>
          </span>
        </button>

        {showLabel && (
          <span className="theme-toggle-status" aria-live="polite">
            {isDark ? 'Dark' : 'Light'}
          </span>
        )}
      </div>
    </div>
  );
};

export default ThemeToggle;