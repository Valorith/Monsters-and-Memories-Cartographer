-- Add type column to POIs table
ALTER TABLE pois 
ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'landmark';

-- Update the default for future POIs
ALTER TABLE pois 
ALTER COLUMN type SET DEFAULT 'landmark';