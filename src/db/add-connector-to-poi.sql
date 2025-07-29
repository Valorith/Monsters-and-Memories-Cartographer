-- Add to_poi_id column to point_connectors table
ALTER TABLE point_connectors 
ADD COLUMN IF NOT EXISTS to_poi_id INTEGER REFERENCES pois(id) ON DELETE CASCADE;

-- Make to_x and to_y nullable for POI connections
ALTER TABLE point_connectors 
ALTER COLUMN to_x DROP NOT NULL,
ALTER COLUMN to_y DROP NOT NULL;

-- Add a check constraint to ensure either (to_x, to_y) or to_poi_id is set
ALTER TABLE point_connectors 
ADD CONSTRAINT check_to_location 
CHECK (
  (to_x IS NOT NULL AND to_y IS NOT NULL AND to_poi_id IS NULL) OR
  (to_x IS NULL AND to_y IS NULL AND to_poi_id IS NOT NULL)
);