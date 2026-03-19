import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import './Settings.css';

const Settings = () => {
  const { theme, setTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState(theme);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSelectedTheme(theme);
    checkTwoFactorStatus();
  }, [theme]);

  const checkTwoFactorStatus = async () => {
    try {
      const response = await fetch('/api/auth/2fa/status', {
        method: 'GET',
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setTwoFactorEnabled(data.enabled);
      }
    } catch (error) {
      console.error('Failed to check 2FA status:', error);
    }
  };

  const handleThemeChange = (newTheme) => {
    setSelectedTheme(newTheme);
    setTheme(newTheme);
  };

  const handleEnable2FA = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setQrCodeUrl(data.qrCode);
        setShowQRCode(true);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to setup 2FA');
      }
    } catch (error) {
      setError('Failed to setup 2FA. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!verificationCode.trim()) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ token: verificationCode.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setTwoFactorEnabled(true);
        setBackupCodes(data.backupCodes);
        setShowBackupCodes(true);
        setShowQRCode(false);
        setVerificationCode('');
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Invalid verification code');
      }
    } catch (error) {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!window.confirm('Are you sure you want to disable two-factor authentication? This will make your account less secure.')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        setTwoFactorEnabled(false);
        setShowQRCode(false);
        setShowBackupCodes(false);
        setBackupCodes([]);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to disable 2FA');
      }
    } catch (error) {
      setError('Failed to disable 2FA. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSetup = () => {
    setShowQRCode(false);
    setVerificationCode('');
    setError('');
  };

  const copyBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    navigator.clipboard.writeText(codesText).then(() => {
      alert('Backup codes copied to clipboard');
    });
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
                Add an extra layer of security to your account by requiring a second form of authentication
              </p>
            </div>
            
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="twofa-status">
              <div className="setting-item">
                <span className="setting-label">
                  Status: {twoFactorEnabled ? (
                    <span className="status-enabled">✓ Enabled</span>
                  ) : (
                    <span className="status-disabled">✗ Disabled</span>
                  )}
                </span>
                
                {!twoFactorEnabled ? (
                  <button
                    onClick={handleEnable2FA}
                    disabled={loading}
                    className="btn btn-primary"
                  >
                    {loading ? 'Setting up...' : 'Enable 2FA'}
                  </button>
                ) : (
                  <button
                    onClick={handleDisable2FA}
                    disabled={loading}
                    className="btn btn-danger"
                  >
                    {loading ? 'Disabling...' : 'Disable 2FA'}
                  </button>
                )}
              </div>
            </div>

            {showQRCode && (
              <div className="twofa-setup">
                <h4>Setup Two-Factor Authentication</h4>
                <div className="setup-instructions">
                  <p>1. Install an authenticator app like Google Authenticator or Authy</p>
                  <p>2. Scan the QR code below with your authenticator app</p>
                  <p>3. Enter the 6-digit code from your app to complete setup</p>
                </div>
                
                <div className="qr-code-container">
                  <img src={qrCodeUrl} alt="2FA QR Code" className="qr-code" />
                </div>
                
                <div className="verification-input">
                  <label htmlFor="verification-code">Enter verification code:</label>
                  <input
                    id="verification-code"
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="000000"
                    maxLength="6"
                    className="code-input"
                  />
                </div>
                
                <div className="setup-buttons">
                  <button
                    onClick={handleVerify2FA}
                    disabled={loading || !verificationCode.trim()}
                    className="btn btn-primary"
                  >
                    {loading ? 'Verifying...' : 'Verify & Enable'}
                  </button>
                  <button
                    onClick={handleCancelSetup}
                    disabled={loading}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {showBackupCodes && backupCodes.length > 0 && (
              <div className="backup-codes-section">
                <h4>Backup Codes</h4>
                <p className="backup-codes-description">
                  Save these backup codes in a safe place. You can use them to access your account if you lose your authenticator device.
                </p>
                
                <div className="backup-codes-container">
                  <div className="backup-codes">
                    {backupCodes.map((code, index) => (
                      <div key={index} className="backup-code">{code}</div>
                    ))}
                  </div>
                  
                  <button onClick={copyBackupCodes} className="btn btn-secondary">
                    Copy Codes
                  </button>
                </div>
                
                <button
                  onClick={() => setShowBackupCodes(false)}
                  className="btn btn-primary"
                >
                  I've Saved My Backup Codes
                </button>
              </div>
            )}
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