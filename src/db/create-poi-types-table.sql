-- Create POI types table
CREATE TABLE IF NOT EXISTS poi_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    icon_type VARCHAR(20) NOT NULL DEFAULT 'emoji' CHECK (icon_type IN ('emoji', 'upload', 'fontawesome')),
    icon_value TEXT NOT NULL, -- emoji character, file path, or fontawesome class
    display_order INTEGER NOT NULL DEFAULT 0,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure only one default type
CREATE UNIQUE INDEX idx_only_one_default ON poi_types (is_default) WHERE is_default = true;

-- Create index for ordering
CREATE INDEX idx_poi_types_order ON poi_types (display_order);

-- Insert the 'Unknown' type as the initial default
INSERT INTO poi_types (name, icon_type, icon_value, display_order, is_default) 
VALUES ('Unknown', 'emoji', '❓', 0, true)
ON CONFLICT (name) DO NOTHING;

-- Add type_id column to pois table
ALTER TABLE pois 
ADD COLUMN IF NOT EXISTS type_id INTEGER REFERENCES poi_types(id);

-- Add type_id column to custom_pois table
ALTER TABLE custom_pois 
ADD COLUMN IF NOT EXISTS type_id INTEGER REFERENCES poi_types(id);

-- Add type_id column to pending_pois table
ALTER TABLE pending_pois 
ADD COLUMN IF NOT EXISTS type_id INTEGER REFERENCES poi_types(id);

-- Create table for uploaded icons
CREATE TABLE IF NOT EXISTS poi_type_icons (
    id SERIAL PRIMARY KEY,
    type_id INTEGER REFERENCES poi_types(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    mime_type VARCHAR(100),
    size INTEGER,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migrate existing POIs to use the Unknown type
UPDATE pois 
SET type_id = (SELECT id FROM poi_types WHERE name = 'Unknown')
WHERE type_id IS NULL;

UPDATE custom_pois 
SET type_id = (SELECT id FROM poi_types WHERE name = 'Unknown')
WHERE type_id IS NULL;

UPDATE pending_pois 
SET type_id = (SELECT id FROM poi_types WHERE name = 'Unknown')
WHERE type_id IS NULL;