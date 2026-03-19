import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { AUTH_CONFIG } from '../../config/auth';
import './LoginForm.css';

const LoginForm = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    twoFactorCode: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  
  const { login, verifyTwoFactor } = useAuth();
  const twoFactorInputRef = useRef(null);

  useEffect(() => {
    if (showTwoFactor && twoFactorInputRef.current) {
      twoFactorInputRef.current.focus();
      // Announce to screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'sr-only';
      announcement.textContent = 'Two-factor authentication required. Please enter your 6-digit verification code.';
      document.body.appendChild(announcement);
      
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);
    }
  }, [showTwoFactor]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    if (showTwoFactor && !formData.twoFactorCode.trim()) {
      newErrors.twoFactorCode = 'Two-factor code is required';
    } else if (showTwoFactor && formData.twoFactorCode.length !== AUTH_CONFIG.TWO_FACTOR_CODE_LENGTH) {
      newErrors.twoFactorCode = `Two-factor code must be ${AUTH_CONFIG.TWO_FACTOR_CODE_LENGTH} digits`;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      if (showTwoFactor) {
        await verifyTwoFactor(formData.email, formData.twoFactorCode);
      } else {
        const result = await login(formData.email, formData.password);
        if (result.requiresTwoFactor) {
          setShowTwoFactor(true);
          return;
        }
      }
      
      // Reset form on success
      setFormData({
        email: '',
        password: '',
        twoFactorCode: ''
      });
      setLoginAttempts(0);
      setShowTwoFactor(false);
      
    } catch (error) {
      setLoginAttempts(prev => prev + 1);
      
      if (error.message.includes('two-factor')) {
        setErrors({ twoFactorCode: error.message });
      } else if (error.message.includes('password')) {
        setErrors({ password: error.message });
      } else if (error.message.includes('email')) {
        setErrors({ email: error.message });
      } else {
        setErrors({ general: error.message || 'Login failed. Please try again.' });
      }
      
      // Reset 2FA state on auth failure
      if (showTwoFactor && error.message.includes('Invalid')) {
        setFormData(prev => ({
          ...prev,
          twoFactorCode: ''
        }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setShowTwoFactor(false);
    setFormData(prev => ({
      ...prev,
      twoFactorCode: ''
    }));
    setErrors({});
  };

  const isAccountLocked = loginAttempts >= AUTH_CONFIG.MAX_LOGIN_ATTEMPTS;

  return (
    <div className="login-form-container">
      <div className="login-form-card">
        <div className="login-header">
          <h1 className="login-title">
            {showTwoFactor ? 'Enter Verification Code' : 'Sign In'}
          </h1>
          <p className="login-subtitle">
            {showTwoFactor 
              ? 'We sent a verification code to your authenticator app'
              : 'Welcome back! Please sign in to your account'
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          {errors.general && (
            <div 
              className="error-banner"
              role="alert"
              aria-live="polite"
            >
              {errors.general}
            </div>
          )}
          
          {isAccountLocked && (
            <div 
              className="warning-banner"
              role="alert"
              aria-live="polite"
            >
              Account temporarily locked due to multiple failed attempts. Please try again later.
            </div>
          )}

          {!showTwoFactor ? (
            <>
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`form-input ${errors.email ? 'error' : ''}`}
                  placeholder="Enter your email"
                  disabled={isLoading || isAccountLocked}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  aria-invalid={errors.email ? 'true' : 'false'}
                  autoComplete="email"
                  required
                />
                {errors.email && (
                  <span 
                    id="email-error" 
                    className="error-text"
                    role="alert"
                  >
                    {errors.email}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`form-input ${errors.password ? 'error' : ''}`}
                  placeholder="Enter your password"
                  disabled={isLoading || isAccountLocked}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  aria-invalid={errors.password ? 'true' : 'false'}
                  autoComplete="current-password"
                  required
                />
                {errors.password && (
                  <span 
                    id="password-error" 
                    className="error-text"
                    role="alert"
                  >
                    {errors.password}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="two-factor-section">
              <div className="form-group">
                <label htmlFor="twoFactorCode" className="form-label">
                  Verification Code
                </label>
                <input
                  type="text"
                  id="twoFactorCode"
                  name="twoFactorCode"
                  value={formData.twoFactorCode}
                  onChange={handleInputChange}
                  className={`form-input two-factor-input ${errors.twoFactorCode ? 'error' : ''}`}
                  placeholder="000000"
                  maxLength={AUTH_CONFIG.TWO_FACTOR_CODE_LENGTH}
                  disabled={isLoading}
                  ref={twoFactorInputRef}
                  aria-describedby="two-factor-help two-factor-error"
                  aria-invalid={errors.twoFactorCode ? 'true' : 'false'}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  role="textbox"
                  required
                />
                <div id="two-factor-help" className="form-help-text">
                  Enter the {AUTH_CONFIG.TWO_FACTOR_CODE_LENGTH}-digit code from your authenticator app
                </div>
                {errors.twoFactorCode && (
                  <span 
                    id="two-factor-error" 
                    className="error-text"
                    role="alert"
                    aria-live="polite"
                  >
                    {errors.twoFactorCode}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleBackToLogin}
                className="back-button"
                disabled={isLoading}
                aria-label="Go back to login form"
              >
                ← Back to Login
              </button>
            </div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              className="submit-button"
              disabled={isLoading || isAccountLocked}
              aria-describedby={isAccountLocked ? 'account-locked-help' : undefined}
            >
              {isLoading ? (
                <>
                  <span className="loading-spinner" aria-hidden="true"></span>
                  {showTwoFactor ? 'Verifying...' : 'Signing in...'}
                </>
              ) : (
                showTwoFactor ? 'Verify Code' : 'Sign In'
              )}
            </button>
            
            {isAccountLocked && (
              <div id="account-locked-help" className="form-help-text">
                Please wait before attempting to sign in again
              </div>
            )}
          </div>

          {!showTwoFactor && (
            <div className="form-footer">
              <a href="/forgot-password" className="forgot-password-link">
                Forgot your password?
              </a>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default LoginForm;