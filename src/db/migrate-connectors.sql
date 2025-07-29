-- Migration script to update point_connectors table for POI connections
-- and update default icons

-- First, backup existing data
CREATE TEMP TABLE point_connectors_backup AS 
SELECT * FROM point_connectors;

-- Drop the old table
DROP TABLE IF EXISTS point_connectors CASCADE;

-- Create new point_connectors table with POI support
CREATE TABLE point_connectors (
  id SERIAL PRIMARY KEY,
  map_id INTEGER REFERENCES maps(id) ON DELETE CASCADE,
  name VARCHAR(255),
  
  -- From point (always coordinates - the connector point)
  from_x INTEGER NOT NULL,
  from_y INTEGER NOT NULL,
  
  -- To point (either coordinates OR POI reference)  
  to_x INTEGER,
  to_y INTEGER,
  to_poi_id INTEGER REFERENCES pois(id) ON DELETE CASCADE,
  
  -- Visual settings for connector endpoints only
  from_icon VARCHAR(10) DEFAULT '🔗',  -- Chain link
  to_icon VARCHAR(10) DEFAULT '🔗',
  from_icon_size INTEGER DEFAULT 20,
  to_icon_size INTEGER DEFAULT 20,
  from_label_visible BOOLEAN DEFAULT true,
  to_label_visible BOOLEAN DEFAULT true,
  from_label_position VARCHAR(10) DEFAULT 'bottom',
  to_label_position VARCHAR(10) DEFAULT 'bottom',
  from_icon_visible BOOLEAN DEFAULT true,
  to_icon_visible BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraint: to point must be EITHER coordinates OR POI
  CONSTRAINT to_point_check CHECK (
    (to_x IS NOT NULL AND to_y IS NOT NULL AND to_poi_id IS NULL) OR
    (to_x IS NULL AND to_y IS NULL AND to_poi_id IS NOT NULL)
  )
);

-- Restore data from backup (all existing connectors are coordinate-based)
INSERT INTO point_connectors (
  id, map_id, name, 
  from_x, from_y, to_x, to_y,
  from_icon, to_icon,
  from_icon_size, to_icon_size,
  from_label_visible, to_label_visible,
  from_label_position, to_label_position,
  from_icon_visible, to_icon_visible,
  created_at, updated_at
)
SELECT 
  id, map_id, name,
  from_x, from_y, to_x, to_y,
  '🔗', '🔗',  -- Update icons to chain link
  from_icon_size, to_icon_size,
  from_label_visible, to_label_visible,
  from_label_position, to_label_position,
  from_icon_visible, to_icon_visible,
  created_at, updated_at
FROM point_connectors_backup;

-- Update zone_connectors default icon to portal
ALTER TABLE zone_connectors 
  ALTER COLUMN from_icon SET DEFAULT '🌀',
  ALTER COLUMN to_icon SET DEFAULT '🌀';

-- Update existing zone_connectors to use portal icon
UPDATE zone_connectors 
SET from_icon = '🌀', to_icon = '🌀'
WHERE from_icon = '🟩' OR to_icon = '🟩';

-- Re-create indexes
CREATE INDEX idx_point_connectors_map_id ON point_connectors(map_id);
CREATE INDEX idx_point_connectors_to_poi ON point_connectors(to_poi_id);

-- Re-create trigger
CREATE TRIGGER update_point_connectors_updated_at BEFORE UPDATE ON point_connectors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Clean up
DROP TABLE point_connectors_backup;

-- Reset sequence if needed
SELECT setval('point_connectors_id_seq', (SELECT MAX(id) FROM point_connectors));