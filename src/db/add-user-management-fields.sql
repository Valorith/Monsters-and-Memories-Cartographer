-- Add user management fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ban_reason TEXT,
ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS banned_by INTEGER REFERENCES users(id);

-- Create warnings table for user warnings
CREATE TABLE IF NOT EXISTS user_warnings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  admin_id INTEGER REFERENCES users(id) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_warnings_user_id ON user_warnings(user_id);