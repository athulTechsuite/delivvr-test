import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import TwoFactorAuth from './TwoFactorAuth';
import './Settings.css';

const Settings = () => {
  const { theme, setTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState(theme);

  useEffect(() => {
    setSelectedTheme(theme);
  }, [theme]);

  const handleThemeChange = (newTheme) => {
    setSelectedTheme(newTheme);
    setTheme(newTheme);
  };

  const themeOptions = [
    {
      value: 'light',
      label: 'Light',
      description: 'Use light theme',
      icon: '☀️'
    },
    {
      value: 'dark',
      label: 'Dark',
      description: 'Use dark theme',
      icon: '🌙'
    },
    {
      value: 'system',
      label: 'System',
      description: 'Follow system setting',
      icon: '⚙️'
    }
  ];

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>Settings</h1>
      </div>
      
      <div className="settings-content">
        <div className="settings-section">
          <h2 className="section-title">Security</h2>
          
          <div className="setting-group">
            <div className="setting-header">
              <h3>Two-Factor Authentication</h3>
              <p className="setting-description">
                Add an extra layer of security to your account by requiring a verification code in addition to your password
              </p>
            </div>
            
            <TwoFactorAuth />
          </div>
        </div>

        <div className="settings-section">
          <h2 className="section-title">Appearance</h2>
          
          <div className="setting-group">
            <div className="setting-header">
              <h3>Theme</h3>
              <p className="setting-description">
                Choose your preferred theme or follow your system setting
              </p>
            </div>
            
            <div className="theme-options">
              {themeOptions.map((option) => (
                <label
                  key={option.value}
                  className={`theme-option ${selectedTheme === option.value ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={option.value}
                    checked={selectedTheme === option.value}
                    onChange={(e) => handleThemeChange(e.target.value)}
                    className="theme-radio"
                  />
                  <div className="theme-option-content">
                    <div className="theme-option-icon">{option.icon}</div>
                    <div className="theme-option-text">
                      <div className="theme-option-label">{option.label}</div>
                      <div className="theme-option-description">{option.description}</div>
                    </div>
                  </div>
                  <div className="theme-option-indicator">
                    {selectedTheme === option.value && (
                      <div className="selected-indicator">✓</div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2 className="section-title">About</h2>
          <div className="setting-group">
            <div className="setting-item">
              <span className="setting-label">Version</span>
              <span className="setting-value">1.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;