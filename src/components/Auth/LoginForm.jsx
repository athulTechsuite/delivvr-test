import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import './LoginForm.css';

const LoginForm = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    twoFactorCode: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [twoFactorAttempts, setTwoFactorAttempts] = useState(0);
  const [tempToken, setTempToken] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();
  const { theme } = useTheme();

  const handleChange = (e) => {
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

  const validateForm = () => {
    const newErrors = {};

    if (!requiresTwoFactor) {
      if (!formData.email) {
        newErrors.email = 'Email is required';
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = 'Email is invalid';
      }

      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters';
      }
    } else {
      if (!formData.twoFactorCode) {
        newErrors.twoFactorCode = '2FA code is required';
      } else if (!/^\d{6}$/.test(formData.twoFactorCode)) {
        newErrors.twoFactorCode = '2FA code must be 6 digits';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      if (!requiresTwoFactor) {
        // First step: email/password authentication
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password
          }),
        });

        const data = await response.json();

        if (response.ok) {
          if (data.requiresTwoFactor) {
            // User has 2FA enabled, show 2FA form
            setRequiresTwoFactor(true);
            setTempToken(data.tempToken);
            setTwoFactorAttempts(0);
          } else {
            // No 2FA required, complete login
            completeLogin(data);
          }
        } else {
          setErrors({ general: data.message || 'Login failed. Please try again.' });
        }
      } else {
        // Second step: 2FA verification
        const response = await fetch('/api/auth/verify-2fa', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tempToken: tempToken,
            twoFactorCode: formData.twoFactorCode
          }),
        });

        const data = await response.json();

        if (response.ok) {
          completeLogin(data);
        } else {
          const newAttempts = twoFactorAttempts + 1;
          setTwoFactorAttempts(newAttempts);
          
          if (data.accountLocked) {
            setErrors({ general: 'Account temporarily locked due to too many failed attempts. Please check your email for further instructions.' });
          } else if (newAttempts >= 5) {
            setErrors({ general: 'Too many failed attempts. Please try again later.' });
          } else {
            setErrors({ 
              twoFactorCode: data.message || 'Invalid 2FA code. Please try again.',
              general: `${5 - newAttempts} attempts remaining.`
            });
          }
          
          // Clear the 2FA code input
          setFormData(prev => ({ ...prev, twoFactorCode: '' }));
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrors({ general: 'Network error. Please check your connection and try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const completeLogin = (data) => {
    // Store token and user data
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    // Update auth context
    login(data.user, data.token);

    // Redirect based on user role
    const redirectPath = getRoleBasedRedirect(data.user.role);
    navigate(redirectPath, { replace: true });
  };

  const handleBackToLogin = () => {
    setRequiresTwoFactor(false);
    setTempToken('');
    setTwoFactorAttempts(0);
    setFormData(prev => ({ ...prev, twoFactorCode: '' }));
    setErrors({});
  };

  const getRoleBasedRedirect = (role) => {
    switch (role) {
      case 'admin':
        return '/admin/dashboard';
      case 'vendor':
        return '/vendor/dashboard';
      case 'customer':
      default:
        return '/dashboard';
    }
  };

  return (
    <div className={`login-form-container ${theme}`} data-theme={theme}>
      <div className="login-form-card">
        <div className="login-header">
          <h2>{requiresTwoFactor ? 'Two-Factor Authentication' : 'Welcome Back'}</h2>
          <p>
            {requiresTwoFactor 
              ? 'Enter the 6-digit code from your authenticator app'
              : 'Sign in to your account'
            }
          </p>
        </div>

        {errors.general && (
          <div className="error-message general-error">
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {!requiresTwoFactor ? (
            <>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={errors.email ? 'error' : ''}
                  placeholder="Enter your email"
                  disabled={isLoading}
                />
                {errors.email && <span className="error-message">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={errors.password ? 'error' : ''}
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
                {errors.password && <span className="error-message">{errors.password}</span>}
              </div>

              <div className="form-options">
                <label className="checkbox-container">
                  <input type="checkbox" />
                  <span className="checkmark"></span>
                  Remember me
                </label>
                <Link to="/forgot-password" className="forgot-password-link">
                  Forgot password?
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="twoFactorCode">Authentication Code</label>
                <input
                  type="text"
                  id="twoFactorCode"
                  name="twoFactorCode"
                  value={formData.twoFactorCode}
                  onChange={handleChange}
                  className={errors.twoFactorCode ? 'error' : ''}
                  placeholder="000000"
                  maxLength="6"
                  disabled={isLoading}
                  autoComplete="off"
                  autoFocus
                />
                {errors.twoFactorCode && <span className="error-message">{errors.twoFactorCode}</span>}
                <small className="form-hint">
                  Enter the 6-digit code from Google Authenticator, Authy, or your preferred authenticator app.
                </small>
              </div>

              <div className="two-factor-options">
                <button
                  type="button"
                  className="back-button"
                  onClick={handleBackToLogin}
                  disabled={isLoading}
                >
                  ← Back to Login
                </button>
                <Link to="/auth/backup-codes" className="backup-codes-link">
                  Use backup code instead
                </Link>
              </div>
            </>
          )}

          <button
            type="submit"
            className={`login-button ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                {requiresTwoFactor ? 'Verifying...' : 'Signing in...'}
              </>
            ) : (
              requiresTwoFactor ? 'Verify Code' : 'Sign In'
            )}
          </button>
        </form>

        {!requiresTwoFactor && (
          <>
            <div className="login-footer">
              <p>
                Don't have an account?{' '}
                <Link to="/register" className="register-link">
                  Sign up
                </Link>
              </p>
            </div>

            <div className="demo-accounts">
              <p className="demo-title">Demo Accounts:</p>
              <div className="demo-buttons">
                <button
                  type="button"
                  className="demo-button customer"
                  onClick={() => setFormData({ email: 'customer@demo.com', password: 'demo123', twoFactorCode: '' })}
                  disabled={isLoading}
                >
                  Customer Demo
                </button>
                <button
                  type="button"
                  className="demo-button admin"
                  onClick={() => setFormData({ email: 'admin@demo.com', password: 'demo123', twoFactorCode: '' })}
                  disabled={isLoading}
                >
                  Admin Demo
                </button>
                <button
                  type="button"
                  className="demo-button vendor"
                  onClick={() => setFormData({ email: 'vendor@demo.com', password: 'demo123', twoFactorCode: '' })}
                  disabled={isLoading}
                >
                  Vendor Demo
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginForm;