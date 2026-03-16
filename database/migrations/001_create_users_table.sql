-- Migration: 001_create_users_table.sql
-- Description: Create users table with role-based authentication support
-- Created: Initial migration for eCommerce platform

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role ENUM('customer', 'admin', 'vendor') NOT NULL DEFAULT 'customer',
    status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX idx_users_password_reset_token ON users(password_reset_token);

-- Create user profiles table for additional user information
CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    avatar_url VARCHAR(500),
    date_of_birth DATE,
    gender ENUM('male', 'female', 'other', 'prefer_not_to_say'),
    bio TEXT,
    preferences JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create user addresses table for shipping and billing
CREATE TABLE IF NOT EXISTS user_addresses (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('billing', 'shipping', 'both') NOT NULL DEFAULT 'both',
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    company VARCHAR(100),
    address_line_1 VARCHAR(255) NOT NULL,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'United States',
    phone VARCHAR(20),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for user_addresses
CREATE INDEX idx_user_addresses_user_id ON user_addresses(user_id);
CREATE INDEX idx_user_addresses_type ON user_addresses(type);
CREATE INDEX idx_user_addresses_is_default ON user_addresses(is_default);

-- Insert default admin user (password should be changed after first login)
-- Password hash for 'admin123' - change this in production
INSERT INTO users (email, password_hash, first_name, last_name, role, status, email_verified) 
VALUES (
    'admin@ecommerce.local', 
    '$2b$10$rQZ1vTzOmvzx4iHnBYOOQeGvF5kF.yQoN8KtXcX7xHnBYOOQeGvF5k', 
    'System', 
    'Administrator', 
    'admin', 
    'active', 
    TRUE
);

-- Create user sessions table for session management
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for user_sessions
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_is_active ON user_sessions(is_active);

-- Create role permissions table for granular permission control
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role ENUM('customer', 'admin', 'vendor') NOT NULL,
    permission VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_role_permission (role, permission)
);

-- Insert default permissions for each role
INSERT INTO role_permissions (role, permission) VALUES
-- Customer permissions
('customer', 'view_products'),
('customer', 'add_to_cart'),
('customer', 'place_order'),
('customer', 'view_own_orders'),
('customer', 'manage_profile'),
('customer', 'manage_addresses'),
('customer', 'manage_wishlist'),

-- Vendor permissions (includes customer permissions)
('vendor', 'view_products'),
('vendor', 'add_to_cart'),
('vendor', 'place_order'),
('vendor', 'view_own_orders'),
('vendor', 'manage_profile'),
('vendor', 'manage_addresses'),
('vendor', 'manage_inventory'),
('vendor', 'view_sales_analytics'),
('vendor', 'manage_own_products'),
('vendor', 'view_vendor_dashboard'),

-- Admin permissions (full access)
('admin', 'view_products'),
('admin', 'manage_products'),
('admin', 'manage_categories'),
('admin', 'manage_users'),
('admin', 'manage_orders'),
('admin', 'view_analytics'),
('admin', 'manage_settings'),
('admin', 'manage_vendors'),
('admin', 'view_admin_dashboard'),
('admin', 'manage_permissions');