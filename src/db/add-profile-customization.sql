-- Add profile customization fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS nickname VARCHAR(50),
ADD COLUMN IF NOT EXISTS custom_avatar TEXT,
ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMP;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);