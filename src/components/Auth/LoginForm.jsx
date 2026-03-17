import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import './LoginForm.css';

const LoginForm = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
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
        // Store token and user data
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Update auth context
        login(data.user, data.token);

        // Redirect based on user role
        const redirectPath = getRoleBasedRedirect(data.user.role);
        navigate(redirectPath, { replace: true });
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
    <div className={`login-form-container ${theme}`}>
      <div className={`login-form-card ${theme}`}>
        <div className={`login-header ${theme}`}>
          <h2>Welcome Back</h2>
          <p>Sign in to your account</p>
        </div>

        {errors.general && (
          <div className={`error-message general-error ${theme}`}>
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit} className={`login-form ${theme}`}>
          <div className={`form-group ${theme}`}>
            <label htmlFor="email" className={theme}>Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`${errors.email ? 'error' : ''} ${theme}`}
              placeholder="Enter your email"
              disabled={isLoading}
            />
            {errors.email && <span className={`error-message ${theme}`}>{errors.email}</span>}
          </div>

          <div className={`form-group ${theme}`}>
            <label htmlFor="password" className={theme}>Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`${errors.password ? 'error' : ''} ${theme}`}
              placeholder="Enter your password"
              disabled={isLoading}
            />
            {errors.password && <span className={`error-message ${theme}`}>{errors.password}</span>}
          </div>

          <div className={`form-options ${theme}`}>
            <label className={`checkbox-container ${theme}`}>
              <input type="checkbox" className={theme} />
              <span className={`checkmark ${theme}`}></span>
              Remember me
            </label>
            <Link to="/forgot-password" className={`forgot-password-link ${theme}`}>
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            className={`login-button ${isLoading ? 'loading' : ''} ${theme}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className={`spinner ${theme}`}></span>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className={`login-footer ${theme}`}>
          <p>
            Don't have an account?{' '}
            <Link to="/register" className={`register-link ${theme}`}>
              Sign up
            </Link>
          </p>
        </div>

        <div className={`demo-accounts ${theme}`}>
          <p className={`demo-title ${theme}`}>Demo Accounts:</p>
          <div className={`demo-buttons ${theme}`}>
            <button
              type="button"
              className={`demo-button customer ${theme}`}
              onClick={() => setFormData({ email: 'customer@demo.com', password: 'demo123' })}
              disabled={isLoading}
            >
              Customer Demo
            </button>
            <button
              type="button"
              className={`demo-button admin ${theme}`}
              onClick={() => setFormData({ email: 'admin@demo.com', password: 'demo123' })}
              disabled={isLoading}
            >
              Admin Demo
            </button>
            <button
              type="button"
              className={`demo-button vendor ${theme}`}
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