-- Migration: Add Two-Factor Authentication fields to users table
-- Created: 2024-01-15
-- Description: Adds columns to support TOTP and SMS-based 2FA with backup recovery codes

BEGIN;

-- Add 2FA related columns to users table
ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN two_factor_method VARCHAR(20) DEFAULT 'totp' CHECK (two_factor_method IN ('totp', 'sms'));
ALTER TABLE users ADD COLUMN two_factor_phone VARCHAR(20) NULL;
ALTER TABLE users ADD COLUMN two_factor_backup_codes TEXT NULL; -- JSON array of hashed backup codes
ALTER TABLE users ADD COLUMN two_factor_enabled_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN two_factor_failed_attempts INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN two_factor_locked_until TIMESTAMP NULL;

-- Create index for performance on 2FA lookups
CREATE INDEX idx_users_two_factor_enabled ON users(two_factor_enabled);
CREATE INDEX idx_users_two_factor_locked ON users(two_factor_locked_until);

-- Add comments for documentation
COMMENT ON COLUMN users.two_factor_enabled IS 'Whether 2FA is enabled for this user';
COMMENT ON COLUMN users.two_factor_secret IS 'Base32 encoded secret for TOTP generation';
COMMENT ON COLUMN users.two_factor_method IS 'Method of 2FA: totp (authenticator app) or sms';
COMMENT ON COLUMN users.two_factor_phone IS 'Phone number for SMS-based 2FA';
COMMENT ON COLUMN users.two_factor_backup_codes IS 'JSON array of hashed backup recovery codes';
COMMENT ON COLUMN users.two_factor_enabled_at IS 'Timestamp when 2FA was first enabled';
COMMENT ON COLUMN users.two_factor_failed_attempts IS 'Number of consecutive failed 2FA attempts';
COMMENT ON COLUMN users.two_factor_locked_until IS 'Timestamp until when 2FA attempts are locked due to failures';

COMMIT;