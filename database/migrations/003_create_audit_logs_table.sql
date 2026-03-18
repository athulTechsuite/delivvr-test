-- Migration: Create audit_logs table
-- Description: Track all CRUD operations on items for audit purposes
-- Created: 2024
-- Security Note: old_values and new_values contain sensitive data and should be
-- encrypted at application level before storage and access-controlled via proper
-- authentication middleware to ensure only authorized administrators can view audit logs
-- 
-- SECURITY REQUIREMENTS:
-- 1. Application MUST implement AES-256 encryption for old_values and new_values fields
-- 2. Encryption keys MUST be stored separately from database (environment variables/key management)
-- 3. Data MUST be encrypted before INSERT/UPDATE operations
-- 4. Data MUST be decrypted only when accessed by authorized administrators
-- 5. Consider implementing field-level encryption or use database encryption features

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('CREATE', 'READ', 'UPDATE', 'DELETE')),
    table_name VARCHAR(50) NOT NULL CHECK (LENGTH(table_name) <= 50 AND table_name NOT LIKE '%[^a-zA-Z0-9_]%' AND table_name NOT LIKE '[0-9]%'),
    record_id INTEGER NOT NULL CHECK (record_id > 0),
    -- CRITICAL SECURITY: These fields contain sensitive data and MUST be encrypted at application level
    -- Required: Implement AES-256 encryption before storing any data in these fields
    -- Access should be restricted to authenticated administrators only
    -- SECURITY: These fields must only be populated via parameterized queries
    -- Application layer must validate JSON format and encrypt before storage
    old_values TEXT CHECK (old_values IS NULL OR (LENGTH(old_values) <= 65535 AND json_valid(old_values))), -- MUST BE ENCRYPTED JSON data
    new_values TEXT CHECK (new_values IS NULL OR (LENGTH(new_values) <= 65535 AND json_valid(new_values))), -- MUST BE ENCRYPTED JSON data
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