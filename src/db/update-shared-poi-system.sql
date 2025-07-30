-- Update the shared POI system for persistent share codes

-- Add share_code column to custom_pois table if it doesn't exist
ALTER TABLE custom_pois ADD COLUMN IF NOT EXISTS share_code VARCHAR(10) UNIQUE;
ALTER TABLE custom_pois ADD COLUMN IF NOT EXISTS share_code_created_at TIMESTAMP;
ALTER TABLE custom_pois ADD COLUMN IF NOT EXISTS share_code_revoked BOOLEAN DEFAULT FALSE;

-- Create an index on share_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_custom_pois_share_code ON custom_pois(share_code) WHERE share_code IS NOT NULL;

-- Create shared_pois table to track who has added which shared POIs
CREATE TABLE IF NOT EXISTS shared_pois (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  custom_poi_id INTEGER NOT NULL REFERENCES custom_pois(id) ON DELETE CASCADE,
  share_code VARCHAR(10) NOT NULL, -- Store the code used to add it
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE, -- False when the share code is revoked
  UNIQUE(user_id, custom_poi_id) -- A user can only add a POI once
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shared_pois_user_id ON shared_pois(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_pois_custom_poi_id ON shared_pois(custom_poi_id);
CREATE INDEX IF NOT EXISTS idx_shared_pois_share_code ON shared_pois(share_code);

-- Add a trigger to update is_active when share codes are revoked
CREATE OR REPLACE FUNCTION update_shared_pois_active_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When a share code is revoked or changed, update all related shared_pois entries
  IF (OLD.share_code IS DISTINCT FROM NEW.share_code) OR 
     (OLD.share_code_revoked IS DISTINCT FROM NEW.share_code_revoked) THEN
    UPDATE shared_pois 
    SET is_active = FALSE 
    WHERE custom_poi_id = NEW.id 
    AND (share_code != NEW.share_code OR NEW.share_code_revoked = TRUE OR NEW.share_code IS NULL);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS update_shared_pois_on_code_change ON custom_pois;
CREATE TRIGGER update_shared_pois_on_code_change
AFTER UPDATE ON custom_pois
FOR EACH ROW
EXECUTE FUNCTION update_shared_pois_active_status();