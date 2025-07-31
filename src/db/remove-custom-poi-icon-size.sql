-- Remove icon_size column from custom_pois and pending_pois tables
-- This ensures all custom POIs use consistent sizing like regular POIs

ALTER TABLE custom_pois DROP COLUMN IF EXISTS icon_size;
ALTER TABLE pending_pois DROP COLUMN IF EXISTS icon_size;