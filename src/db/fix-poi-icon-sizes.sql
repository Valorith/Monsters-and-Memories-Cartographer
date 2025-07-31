-- Fix icon sizes for custom POIs and published POIs to match regular POIs
-- Regular POIs have default icon_size of 34, but custom POIs defaulted to 24

-- Update existing custom POIs to use standard icon size
UPDATE custom_pois 
SET icon_size = 34 
WHERE icon_size = 24 OR icon_size IS NULL;

-- Update existing pending POIs to use standard icon size
UPDATE pending_pois 
SET icon_size = 34 
WHERE icon_size = 24 OR icon_size IS NULL;

-- Update regular POIs that came from custom POIs (they would have kept the 24px size)
-- We can identify these by their created_by_user_id being not null
UPDATE pois 
SET icon_size = 34 
WHERE icon_size = 24 AND created_by_user_id IS NOT NULL;

-- Update the default value for future custom POIs
ALTER TABLE custom_pois 
ALTER COLUMN icon_size SET DEFAULT 34;

-- Update the default value for future pending POIs
ALTER TABLE pending_pois 
ALTER COLUMN icon_size SET DEFAULT 34;