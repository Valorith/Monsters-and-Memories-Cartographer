-- Clean up old share system components that are no longer needed

-- Drop the old share_links table if it exists
DROP TABLE IF EXISTS share_links CASCADE;

-- Remove old share-related columns from custom_pois if they exist
-- (The new system uses share_code instead of individual share links)
ALTER TABLE custom_pois DROP COLUMN IF EXISTS share_count CASCADE;