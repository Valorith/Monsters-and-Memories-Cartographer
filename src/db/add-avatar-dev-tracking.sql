-- Add development environment avatar missing count tracking
-- This helps when sharing a database between dev and prod environments
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS avatar_missing_count_dev INTEGER DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN users.avatar_missing_count_dev IS 'Tracks avatar missing count in development environment when sharing DB between environments';