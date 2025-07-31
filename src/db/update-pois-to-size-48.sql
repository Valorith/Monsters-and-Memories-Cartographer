-- Update all POIs (regular and custom) to use icon_size 48
-- This ensures consistency across all POIs created through any means

-- Update existing regular POIs to use icon size 48
UPDATE pois 
SET icon_size = 48 
WHERE icon_size != 48 OR icon_size IS NULL;

-- Update existing custom POIs to use icon size 48
UPDATE custom_pois 
SET icon_size = 48 
WHERE icon_size != 48 OR icon_size IS NULL;

-- Update existing pending POIs to use icon size 48
UPDATE pending_pois 
SET icon_size = 48 
WHERE icon_size != 48 OR icon_size IS NULL;

-- Update the default value for future POIs
ALTER TABLE pois 
ALTER COLUMN icon_size SET DEFAULT 48;

-- Update the default value for future custom POIs
ALTER TABLE custom_pois 
ALTER COLUMN icon_size SET DEFAULT 48;

-- Update the default value for future pending POIs
ALTER TABLE pending_pois 
ALTER COLUMN icon_size SET DEFAULT 48;