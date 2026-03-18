-- Migration: Create audit_logs table
-- Description: Track all CRUD operations on items for audit purposes
-- Created: 2024
-- Security Note: old_values and new_values contain sensitive data and should be
-- encrypted at application level before storage and access-controlled via proper
-- authentication middleware to ensure only authorized administrators can view audit logs

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    -- These fields contain sensitive data and must be encrypted at application level
    -- Access should be restricted to authenticated administrators only
    old_values TEXT, -- Encrypted sensitive data
    new_values TEXT, -- Encrypted sensitive data
    ip_address VARCHAR(45),
    user_agent TEXT,
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