-- Custom POIs table for user-created points of interest
CREATE TABLE IF NOT EXISTS custom_pois (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  map_id INTEGER REFERENCES maps(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  icon VARCHAR(50) DEFAULT '📍',
  icon_size INTEGER DEFAULT 24,
  label_visible BOOLEAN DEFAULT true,
  label_position VARCHAR(10) DEFAULT 'bottom',
  custom_icon VARCHAR(10),
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Custom POI shares table for sharing POIs with other users
CREATE TABLE IF NOT EXISTS custom_poi_shares (
  id SERIAL PRIMARY KEY,
  custom_poi_id INTEGER REFERENCES custom_pois(id) ON DELETE CASCADE NOT NULL,
  shared_with_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  shared_by_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  accepted BOOLEAN DEFAULT false,
  share_link VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(custom_poi_id, shared_with_user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_custom_pois_user_id ON custom_pois(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_pois_map_id ON custom_pois(map_id);
CREATE INDEX IF NOT EXISTS idx_custom_poi_shares_poi_id ON custom_poi_shares(custom_poi_id);
CREATE INDEX IF NOT EXISTS idx_custom_poi_shares_shared_with ON custom_poi_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_custom_poi_shares_link ON custom_poi_shares(share_link);

-- Add update timestamp triggers
DROP TRIGGER IF EXISTS update_custom_pois_updated_at ON custom_pois;
CREATE TRIGGER update_custom_pois_updated_at BEFORE UPDATE ON custom_pois
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique share links
CREATE OR REPLACE FUNCTION generate_share_link() RETURNS VARCHAR AS $$
DECLARE
    chars VARCHAR := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    result VARCHAR := '';
    i INTEGER;
BEGIN
    FOR i IN 1..10 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;