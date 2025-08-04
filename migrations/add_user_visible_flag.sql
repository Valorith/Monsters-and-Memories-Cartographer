-- Add visible flag to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS visible BOOLEAN DEFAULT true;

-- Set System user to not visible (assuming ID 1 or specific email)
UPDATE users SET visible = false WHERE name = 'System' OR email = 'system@mmcartographer.com';

-- Add index for performance when filtering visible users
CREATE INDEX IF NOT EXISTS idx_users_visible ON users(visible) WHERE visible = true;