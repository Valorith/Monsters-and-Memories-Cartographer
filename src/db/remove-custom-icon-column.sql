-- Remove the legacy custom_icon column from pois table
-- This column is no longer needed as icons are now managed through the poi_types table

-- Remove custom_icon column from main pois table
ALTER TABLE pois 
DROP COLUMN IF EXISTS custom_icon;

-- Remove custom_icon column from custom_pois table (if it exists)
ALTER TABLE custom_pois 
DROP COLUMN IF EXISTS custom_icon;

-- Remove custom_icon column from pending_pois table (if it exists)
ALTER TABLE pending_pois 
DROP COLUMN IF EXISTS custom_icon;