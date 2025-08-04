-- Add missing columns to custom_pois table if they don't exist

-- Add type_id column to link to poi_types
ALTER TABLE custom_pois ADD COLUMN IF NOT EXISTS type_id INTEGER REFERENCES poi_types(id);

-- Add status column for approval workflow
ALTER TABLE custom_pois ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_custom_pois_type_id ON custom_pois(type_id);
CREATE INDEX IF NOT EXISTS idx_custom_pois_status ON custom_pois(status);

-- Update any existing custom POIs to have a default type if type_id is null
UPDATE custom_pois 
SET type_id = (SELECT id FROM poi_types WHERE name = 'Landmark' LIMIT 1)
WHERE type_id IS NULL;