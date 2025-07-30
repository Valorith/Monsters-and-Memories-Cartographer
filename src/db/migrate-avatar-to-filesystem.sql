-- Migrate from storing base64 avatars in database to storing file paths
-- This will store just the filename in the database, with files stored in /public/avatars/

-- Add new column for avatar filename
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS avatar_filename VARCHAR(255);

-- Add column to track avatar upload timestamp (useful for cache busting)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS avatar_version INTEGER DEFAULT 1;

-- Note: The actual data migration from custom_avatar to files should be done 
-- by a separate script that:
-- 1. Reads each user's custom_avatar base64 data
-- 2. Decodes and saves to file system
-- 3. Updates avatar_filename with the filename
-- 4. Sets custom_avatar to NULL

-- After migration is complete, the custom_avatar column can be dropped:
-- ALTER TABLE users DROP COLUMN custom_avatar;