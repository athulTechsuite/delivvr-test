import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import './LoginForm.css';

const LoginForm = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [twoFactorData, setTwoFactorData] = useState({
    code: '',
    useRecoveryCode: false
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [twoFactorMethods, setTwoFactorMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [smsRequestLoading, setSmsRequestLoading] = useState(false);
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

  const handleTwoFactorChange = (e) => {
    const { name, value, type, checked } = e.target;
    setTwoFactorData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error when user starts typing
    if (errors.twoFactor) {
      setErrors(prev => ({
        ...prev,
        twoFactor: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateTwoFactor = () => {
    const newErrors = {};

    if (!twoFactorData.code) {
      newErrors.twoFactor = twoFactorData.useRecoveryCode 
        ? 'Recovery code is required' 
        : 'Verification code is required';
    } else if (!twoFactorData.useRecoveryCode && !/^\d{6}$/.test(twoFactorData.code)) {
      newErrors.twoFactor = 'Please enter a valid 6-digit code';
    } else if (twoFactorData.useRecoveryCode && twoFactorData.code.length !== 10) {
      newErrors.twoFactor = 'Recovery code must be 10 characters';
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
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.requiresTwoFactor) {
          // User has 2FA enabled, show 2FA form
          setShowTwoFactor(true);
          setTwoFactorMethods(data.availableMethods || []);
          setSelectedMethod(data.availableMethods?.[0] || '');
          setTempToken(data.tempToken);
          
          // If SMS is the default method, automatically send SMS
          if (data.availableMethods?.includes('sms') && data.availableMethods[0] === 'sms') {
            await requestSmsCode(data.tempToken);
          }
        } else {
          // No 2FA required, complete login
          completeLogin(data);
        }
      } else {
        setErrors({ general: data.message || 'Login failed. Please try again.' });
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrors({ general: 'Network error. Please check your connection and try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateTwoFactor()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tempToken,
          code: twoFactorData.code,
          method: twoFactorData.useRecoveryCode ? 'recovery' : selectedMethod
        }),
      });

      const data = await response.json();

      if (response.ok) {
        completeLogin(data);
      } else {
        setErrors({ twoFactor: data.message || 'Invalid verification code. Please try again.' });
      }
    } catch (error) {
      console.error('2FA verification error:', error);
      setErrors({ twoFactor: 'Network error. Please check your connection and try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const requestSmsCode = async (token = tempToken) => {
    setSmsRequestLoading(true);
    try {
      const response = await fetch('/api/auth/request-sms-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tempToken: token }),
      });

      if (!response.ok) {
        const data = await response.json();
        setErrors({ twoFactor: data.message || 'Failed to send SMS code' });
      }
    } catch (error) {
      console.error('SMS request error:', error);
      setErrors({ twoFactor: 'Failed to send SMS code' });
    } finally {
      setSmsRequestLoading(false);
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

  const handleMethodChange = async (method) => {
    setSelectedMethod(method);
    setTwoFactorData(prev => ({ ...prev, code: '' }));
    setErrors({});
    
    // If switching to SMS, request a new code
    if (method === 'sms') {
      await requestSmsCode();
    }
  };

  const handleBackToLogin = () => {
    setShowTwoFactor(false);
    setTwoFactorData({ code: '', useRecoveryCode: false });
    setErrors({});
    setTempToken('');
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

  if (showTwoFactor) {
    return (
      <div className={`login-form-container ${theme}`} data-theme={theme}>
        <div className="login-form-card">
          <div className="login-header">
            <h2>Two-Factor Authentication</h2>
            <p>Enter your verification code to continue</p>
          </div>

          {errors.twoFactor && (
            <div className="error-message general-error">
              {errors.twoFactor}
            </div>
          )}

          <form onSubmit={handleTwoFactorSubmit} className="login-form">
            {!twoFactorData.useRecoveryCode && twoFactorMethods.length > 1 && (
              <div className="form-group">
                <label>Verification Method</label>
                <div className="method-selector">
                  {twoFactorMethods.map(method => (
                    <button
                      key={method}
                      type="button"
                      className={`method-button ${selectedMethod === method ? 'active' : ''}`}
                      onClick={() => handleMethodChange(method)}
                      disabled={isLoading}
                    >
                      {method === 'totp' ? 'Authenticator App' : 'SMS'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="twoFactorCode">
                {twoFactorData.useRecoveryCode 
                  ? 'Recovery Code' 
                  : selectedMethod === 'sms' 
                    ? 'SMS Code' 
                    : 'Authenticator Code'
                }
              </label>
              <input
                type="text"
                id="twoFactorCode"
                name="code"
                value={twoFactorData.code}
                onChange={handleTwoFactorChange}
                className={errors.twoFactor ? 'error' : ''}
                placeholder={twoFactorData.useRecoveryCode ? 'Enter recovery code' : 'Enter 6-digit code'}
                disabled={isLoading}
                maxLength={twoFactorData.useRecoveryCode ? 10 : 6}
              />
              {errors.twoFactor && <span className="error-message">{errors.twoFactor}</span>}
            </div>

            {selectedMethod === 'sms' && !twoFactorData.useRecoveryCode && (
              <div className="sms-actions">
                <button
                  type="button"
                  className="resend-sms-button"
                  onClick={() => requestSmsCode()}
                  disabled={smsRequestLoading || isLoading}
                >
                  {smsRequestLoading ? 'Sending...' : 'Resend SMS Code'}
                </button>
              </div>
            )}

            <div className="form-options">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  name="useRecoveryCode"
                  checked={twoFactorData.useRecoveryCode}
                  onChange={handleTwoFactorChange}
                  disabled={isLoading}
                />
                <span className="checkmark"></span>
                Use recovery code instead
              </label>
            </div>

            <button
              type="submit"
              className={`login-button ${isLoading ? 'loading' : ''}`}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  Verifying...
                </>
              ) : (
                'Verify Code'
              )}
            </button>

            <button
              type="button"
              className="back-button"
              onClick={handleBackToLogin}
              disabled={isLoading}
            >
              ← Back to Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`login-form-container ${theme}`} data-theme={theme}>
      <div className="login-form-card">
        <div className="login-header">
          <h2>Welcome Back</h2>
          <p>Sign in to your account</p>
        </div>

        {errors.general && (
          <div className="error-message general-error">
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
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

          <button
            type="submit"
            className={`login-button ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

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
              onClick={() => setFormData({ email: 'customer@demo.com', password: 'demo123' })}
              disabled={isLoading}
            >
              Customer Demo
            </button>
            <button
              type="button"
              className="demo-button admin"
              onClick={() => setFormData({ email: 'admin@demo.com', password: 'demo123' })}
              disabled={isLoading}
            >
              Admin Demo
            </button>
            <button
              type="button"
              className="demo-button vendor"
              onClick={() => setFormData({ email: 'vendor@demo.com', password: 'demo123' })}
              disabled={isLoading}
            >
              Vendor Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;