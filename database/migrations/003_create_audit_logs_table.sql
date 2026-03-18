-- Create audit_logs table for tracking all item changes
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    changed_by INTEGER NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    
    -- Foreign key to users table
    CONSTRAINT fk_audit_logs_changed_by 
        FOREIGN KEY (changed_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL
);

-- Create indexes for better query performance
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_changed_by ON audit_logs(changed_by);
CREATE INDEX idx_audit_logs_changed_at ON audit_logs(changed_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- Create a composite index for common queries
CREATE INDEX idx_audit_logs_table_action_date ON audit_logs(table_name, action, changed_at DESC);

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Tracks all changes to items and other entities for admin dashboard audit trail';
COMMENT ON COLUMN audit_logs.table_name IS 'Name of the table that was modified';
COMMENT ON COLUMN audit_logs.record_id IS 'ID of the record that was modified';
COMMENT ON COLUMN audit_logs.action IS 'Type of operation performed (CREATE, UPDATE, DELETE)';
COMMENT ON COLUMN audit_logs.old_values IS 'JSON object containing the previous values before change';
COMMENT ON COLUMN audit_logs.new_values IS 'JSON object containing the new values after change';
COMMENT ON COLUMN audit_logs.changed_by IS 'User ID of the person who made the change';
COMMENT ON COLUMN audit_logs.changed_at IS 'Timestamp when the change was made';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of the user making the change';
COMMENT ON COLUMN audit_logs.user_agent IS 'User agent string of the browser/client making the change';