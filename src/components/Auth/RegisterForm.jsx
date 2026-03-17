import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import './RegisterForm.css';

const RegisterForm = ({ onRegister }) => {
  const { theme } = useTheme();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'customer',
    phone: '',
    dateOfBirth: '',
    acceptTerms: false
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    // Name validation
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Phone validation (optional)
    if (formData.phone && !/^\+?[\d\s\-\(\)]+$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    // Terms acceptance
    if (!formData.acceptTerms) {
      newErrors.acceptTerms = 'You must accept the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
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
      const registrationData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        phone: formData.phone || null,
        dateOfBirth: formData.dateOfBirth || null
      };

      await onRegister(registrationData);
    } catch (error) {
      setErrors({ submit: error.message || 'Registration failed. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`register-form-container ${theme}`}>
      <div className={`register-form-card ${theme}`}>
        <div className={`register-form-header ${theme}`}>
          <h2>Create Your Account</h2>
          <p>Join our eCommerce platform and start shopping!</p>
        </div>

        <form onSubmit={handleSubmit} className={`register-form ${theme}`}>
          {errors.submit && (
            <div className={`error-message submit-error ${theme}`}>
              {errors.submit}
            </div>
          )}

          <div className="form-row">
            <div className={`form-group ${theme}`}>
              <label htmlFor="firstName">First Name *</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className={`${errors.firstName ? 'error' : ''} ${theme}`}
                placeholder="Enter your first name"
              />
              {errors.firstName && <span className={`error-message ${theme}`}>{errors.firstName}</span>}
            </div>

            <div className={`form-group ${theme}`}>
              <label htmlFor="lastName">Last Name *</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className={`${errors.lastName ? 'error' : ''} ${theme}`}
                placeholder="Enter your last name"
              />
              {errors.lastName && <span className={`error-message ${theme}`}>{errors.lastName}</span>}
            </div>
          </div>

          <div className={`form-group ${theme}`}>
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`${errors.email ? 'error' : ''} ${theme}`}
              placeholder="Enter your email address"
            />
            {errors.email && <span className={`error-message ${theme}`}>{errors.email}</span>}
          </div>

          <div className={`form-group ${theme}`}>
            <label htmlFor="role">Account Type *</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className={`${errors.role ? 'error' : ''} ${theme}`}
            >
              <option value="customer">Customer</option>
              <option value="vendor">Vendor</option>
            </select>
            {errors.role && <span className={`error-message ${theme}`}>{errors.role}</span>}
          </div>

          <div className="form-row">
            <div className={`form-group ${theme}`}>
              <label htmlFor="password">Password *</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`${errors.password ? 'error' : ''} ${theme}`}
                placeholder="Create a strong password"
              />
              {errors.password && <span className={`error-message ${theme}`}>{errors.password}</span>}
            </div>

            <div className={`form-group ${theme}`}>
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={`${errors.confirmPassword ? 'error' : ''} ${theme}`}
                placeholder="Confirm your password"
              />
              {errors.confirmPassword && <span className={`error-message ${theme}`}>{errors.confirmPassword}</span>}
            </div>
          </div>

          <div className={`form-group ${theme}`}>
            <label htmlFor="phone">Phone Number</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={`${errors.phone ? 'error' : ''} ${theme}`}
              placeholder="Enter your phone number (optional)"
            />
            {errors.phone && <span className={`error-message ${theme}`}>{errors.phone}</span>}
          </div>

          <div className={`form-group ${theme}`}>
            <label htmlFor="dateOfBirth">Date of Birth</label>
            <input
              type="date"
              id="dateOfBirth"
              name="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={handleChange}
              className={`${errors.dateOfBirth ? 'error' : ''} ${theme}`}
            />
            {errors.dateOfBirth && <span className={`error-message ${theme}`}>{errors.dateOfBirth}</span>}
          </div>

          <div className={`form-group checkbox-group ${theme}`}>
            <label className={`checkbox-label ${theme}`}>
              <input
                type="checkbox"
                name="acceptTerms"
                checked={formData.acceptTerms}
                onChange={handleChange}
                className={`${errors.acceptTerms ? 'error' : ''} ${theme}`}
              />
              <span className={`checkbox-text ${theme}`}>
                I accept the <Link to="/terms" target="_blank" className={theme}>Terms and Conditions</Link> and <Link to="/privacy" target="_blank" className={theme}>Privacy Policy</Link> *
              </span>
            </label>
            {errors.acceptTerms && <span className={`error-message ${theme}`}>{errors.acceptTerms}</span>}
          </div>

          <button 
            type="submit" 
            className={`register-button ${theme}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className={`loading-spinner ${theme}`}>
                <i className="spinner"></i>
                Creating Account...
              </span>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className={`register-form-footer ${theme}`}>
          <p>
            Already have an account? 
            <Link to="/login" className={`login-link ${theme}`}>Sign in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;