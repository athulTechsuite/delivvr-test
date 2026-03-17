import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import './SettingsPage.css';

const SettingsPage = () => {
  const { theme, toggleTheme, systemPreference } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState(theme);

  useEffect(() => {
    setSelectedTheme(theme);
  }, [theme]);

  const handleThemeChange = (newTheme) => {
    setSelectedTheme(newTheme);
    toggleTheme(newTheme);
  };

  const handleKeyDown = (event, themeOption) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleThemeChange(themeOption);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-container">
        <header className="settings-header">
          <h1 className="settings-title">Settings</h1>
          <p className="settings-subtitle">Customize your application preferences</p>
        </header>

        <div className="settings-content">
          <section className="settings-section">
            <div className="section-header">
              <h2 className="section-title">Appearance</h2>
              <p className="section-description">
                Choose how the application looks to you
              </p>
            </div>

            <div className="setting-group">
              <label className="setting-label">
                Theme
                <span className="setting-description">
                  Select your preferred theme. System will use your device's theme setting.
                </span>
              </label>

              <div className="theme-options" role="radiogroup" aria-labelledby="theme-label">
                <div
                  className={`theme-option ${selectedTheme === 'light' ? 'selected' : ''}`}
                  role="radio"
                  tabIndex={selectedTheme === 'light' ? 0 : -1}
                  aria-checked={selectedTheme === 'light'}
                  onClick={() => handleThemeChange('light')}
                  onKeyDown={(e) => handleKeyDown(e, 'light')}
                >
                  <div className="theme-preview light-preview">
                    <div className="preview-header"></div>
                    <div className="preview-content">
                      <div className="preview-text"></div>
                      <div className="preview-text short"></div>
                    </div>
                  </div>
                  <div className="theme-info">
                    <span className="theme-name">Light</span>
                    <span className="theme-desc">Clean and bright interface</span>
                  </div>
                  <div className="theme-radio">
                    <input
                      type="radio"
                      name="theme"
                      value="light"
                      checked={selectedTheme === 'light'}
                      onChange={() => handleThemeChange('light')}
                      aria-label="Light theme"
                    />
                  </div>
                </div>

                <div
                  className={`theme-option ${selectedTheme === 'dark' ? 'selected' : ''}`}
                  role="radio"
                  tabIndex={selectedTheme === 'dark' ? 0 : -1}
                  aria-checked={selectedTheme === 'dark'}
                  onClick={() => handleThemeChange('dark')}
                  onKeyDown={(e) => handleKeyDown(e, 'dark')}
                >
                  <div className="theme-preview dark-preview">
                    <div className="preview-header"></div>
                    <div className="preview-content">
                      <div className="preview-text"></div>
                      <div className="preview-text short"></div>
                    </div>
                  </div>
                  <div className="theme-info">
                    <span className="theme-name">Dark</span>
                    <span className="theme-desc">Easy on the eyes in low light</span>
                  </div>
                  <div className="theme-radio">
                    <input
                      type="radio"
                      name="theme"
                      value="dark"
                      checked={selectedTheme === 'dark'}
                      onChange={() => handleThemeChange('dark')}
                      aria-label="Dark theme"
                    />
                  </div>
                </div>

                <div
                  className={`theme-option ${selectedTheme === 'system' ? 'selected' : ''}`}
                  role="radio"
                  tabIndex={selectedTheme === 'system' ? 0 : -1}
                  aria-checked={selectedTheme === 'system'}
                  onClick={() => handleThemeChange('system')}
                  onKeyDown={(e) => handleKeyDown(e, 'system')}
                >
                  <div className="theme-preview system-preview">
                    <div className="preview-split">
                      <div className="preview-half light">
                        <div className="preview-header"></div>
                        <div className="preview-content">
                          <div className="preview-text"></div>
                        </div>
                      </div>
                      <div className="preview-half dark">
                        <div className="preview-header"></div>
                        <div className="preview-content">
                          <div className="preview-text"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="theme-info">
                    <span className="theme-name">System</span>
                    <span className="theme-desc">
                      Use device setting ({systemPreference})
                    </span>
                  </div>
                  <div className="theme-radio">
                    <input
                      type="radio"
                      name="theme"
                      value="system"
                      checked={selectedTheme === 'system'}
                      onChange={() => handleThemeChange('system')}
                      aria-label="System theme"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="settings-section">
            <div className="section-header">
              <h2 className="section-title">Accessibility</h2>
              <p className="section-description">
                Accessibility features and preferences
              </p>
            </div>

            <div className="setting-group">
              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    className="setting-checkbox"
                    defaultChecked={false}
                  />
                  High contrast mode
                  <span className="setting-description">
                    Increase contrast for better visibility
                  </span>
                </label>
              </div>

              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    className="setting-checkbox"
                    defaultChecked={false}
                  />
                  Reduced motion
                  <span className="setting-description">
                    Minimize animations and transitions
                  </span>
                </label>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;