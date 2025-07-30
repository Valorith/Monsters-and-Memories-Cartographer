-- Remove the custom_avatar field since we now use file-based storage
ALTER TABLE users DROP COLUMN IF EXISTS custom_avatar;