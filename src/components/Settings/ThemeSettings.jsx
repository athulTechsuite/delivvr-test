import React, { useContext, useState } from 'react';
import { ThemeContext } from '../../contexts/ThemeContext';
import './ThemeSettings.css';

const ThemeSettings = () => {
  const { theme, setTheme } = useContext(ThemeContext);
  const [selectedTheme, setSelectedTheme] = useState(theme);

  const handleThemeChange = (newTheme) => {
    setSelectedTheme(newTheme);
    setTheme(newTheme);
  };

  const themeOptions = [
    {
      value: 'light',
      label: 'Light',
      description: 'Clean and bright interface',
      icon: '☀️'
    },
    {
      value: 'dark',
      label: 'Dark',
      description: 'Easy on the eyes in low light',
      icon: '🌙'
    },
    {
      value: 'system',
      label: 'System',
      description: 'Follow device settings',
      icon: '⚙️'
    }
  ];

  return (
    <div className="theme-settings">
      <div className="theme-settings__header">
        <h3 className="theme-settings__title">Theme</h3>
        <p className="theme-settings__subtitle">
          Choose your preferred appearance
        </p>
      </div>

      <div className="theme-settings__options">
        {themeOptions.map((option) => (
          <div
            key={option.value}
            className={`theme-option ${
              selectedTheme === option.value ? 'theme-option--active' : ''
            }`}
            onClick={() => handleThemeChange(option.value)}
            role="radio"
            aria-checked={selectedTheme === option.value}
            aria-label={`Select ${option.label} theme - ${option.description}`}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleThemeChange(option.value);
              }
            }}
          >
            <div className="theme-option__content">
              <div className="theme-option__icon">{option.icon}</div>
              <div className="theme-option__text">
                <h4 className="theme-option__label">{option.label}</h4>
                <p className="theme-option__description">{option.description}</p>
              </div>
            </div>
            <div className="theme-option__radio">
              <input
                type="radio"
                name="theme"
                value={option.value}
                checked={selectedTheme === option.value}
                onChange={() => handleThemeChange(option.value)}
                aria-label={`Select ${option.label} theme - ${option.description}`}
              />
              <div className="theme-option__radio-custom"></div>
            </div>
          </div>
        ))}
      </div>

      <div className="theme-settings__info">
        <div className="theme-settings__info-item">
          <span className="theme-settings__info-icon">ℹ️</span>
          <p className="theme-settings__info-text">
            {selectedTheme === 'system' 
              ? 'Theme will automatically switch based on your device settings'
              : `Currently using ${selectedTheme} theme`
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default ThemeSettings;