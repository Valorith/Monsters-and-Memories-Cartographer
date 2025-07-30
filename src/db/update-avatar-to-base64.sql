-- Update custom_avatar column to store base64 data instead of URLs
-- The TEXT type in PostgreSQL can store up to 1GB, which is more than enough for base64 avatars

-- First, let's add a new column for the migration
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS custom_avatar_base64 TEXT;

-- Note: In production, you would migrate existing avatars here
-- For now, we'll just drop the old column and rename the new one

-- Drop the old column
ALTER TABLE users 
DROP COLUMN IF EXISTS custom_avatar;

-- Rename the new column
ALTER TABLE users 
RENAME COLUMN custom_avatar_base64 TO custom_avatar;