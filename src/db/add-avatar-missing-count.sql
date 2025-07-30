-- Add avatar_missing_count to track temporary file access issues
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_missing_count INTEGER DEFAULT 0;

-- Reset missing count when avatar is successfully accessed
-- This will be handled in the application code