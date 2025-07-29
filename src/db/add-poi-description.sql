-- Add description column to POIs table
ALTER TABLE pois 
ADD COLUMN IF NOT EXISTS description TEXT;