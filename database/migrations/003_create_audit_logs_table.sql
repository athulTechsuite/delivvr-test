-- Migration: Create audit_logs table
-- Description: Track all CRUD operations on items for audit purposes
-- Created: 2024
-- Security Note: old_values and new_values contain sensitive data and MUST be
-- encrypted at application layer before storage. Access control via proper
-- authentication middleware ensures only authorized administrators can view audit logs
-- 
-- SECURITY REQUIREMENTS FOR APPLICATION LAYER:
-- 1. Application MUST implement encryption for old_values and new_values fields before database storage
-- 2. Encryption keys MUST be stored separately from database (environment variables/key management service)
-- 3. Sensitive data MUST be encrypted before INSERT/UPDATE operations
-- 4. Encrypted data MUST only be decrypted when accessed by authorized administrators
-- 5. Use strong encryption algorithms (AES-256 recommended) with proper key management
-- 6. Consider using application-level field encryption libraries or database encryption features
--
-- WARNING: This migration creates plain text fields. The application layer is responsible
-- for encrypting sensitive data before storing it in old_values and new_values columns.

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('CREATE', 'READ', 'UPDATE', 'DELETE')),
    table_name VARCHAR(50) NOT NULL CHECK (LENGTH(table_name) <= 50 AND table_name NOT LIKE '%[^a-zA-Z0-9_]%' AND table_name NOT LIKE '[0-9]%'),
    record_id INTEGER NOT NULL CHECK (record_id > 0),
    -- APPLICATION RESPONSIBILITY: Encrypt sensitive data before storing in these fields
    -- These fields store encrypted data as text - application must handle encryption/decryption
    -- Access should be restricted to authenticated administrators only
    -- Application layer must validate and encrypt data before storage using parameterized queries
    old_values TEXT CHECK (old_values IS NULL OR LENGTH(old_values) <= 65535), -- Stores encrypted JSON data
    new_values TEXT CHECK (new_values IS NULL OR LENGTH(new_values) <= 65535), -- Stores encrypted JSON data
    ip_address VARCHAR(45) CHECK (ip_address IS NULL OR LENGTH(ip_address) <= 45),
    user_agent TEXT CHECK (user_agent IS NULL OR LENGTH(user_agent) <= 1000),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Insert initial migration record
INSERT INTO migrations (filename, executed_at) VALUES ('003_create_audit_logs_table.sql', CURRENT_TIMESTAMP);