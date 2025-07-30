-- Add XP field to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;

-- Add index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_users_xp ON users(xp DESC);