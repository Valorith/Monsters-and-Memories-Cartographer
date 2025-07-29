-- Add label size fields to point_connectors table
ALTER TABLE point_connectors 
ADD COLUMN IF NOT EXISTS from_label_size DECIMAL(3,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS to_label_size DECIMAL(3,2) DEFAULT 1.0;

-- Add label size fields to zone_connectors table  
ALTER TABLE zone_connectors
ADD COLUMN IF NOT EXISTS from_label_size DECIMAL(3,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS to_label_size DECIMAL(3,2) DEFAULT 1.0;

-- Add label size field to pois table (for future use if POIs get persistent labels)
ALTER TABLE pois
ADD COLUMN IF NOT EXISTS label_size DECIMAL(3,2) DEFAULT 1.0;