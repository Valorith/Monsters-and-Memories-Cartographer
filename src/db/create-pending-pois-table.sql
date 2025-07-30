-- Create pending POIs table
CREATE TABLE IF NOT EXISTS pending_pois (
  id SERIAL PRIMARY KEY,
  custom_poi_id INTEGER REFERENCES custom_pois(id) ON DELETE CASCADE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  map_id INTEGER REFERENCES maps(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  icon VARCHAR(50) DEFAULT '📍',
  vote_score INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create pending POI votes table
CREATE TABLE IF NOT EXISTS pending_poi_votes (
  id SERIAL PRIMARY KEY,
  pending_poi_id INTEGER REFERENCES pending_pois(id) ON DELETE CASCADE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  vote INTEGER NOT NULL CHECK (vote IN (-1, 1)),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(pending_poi_id, user_id)
);

-- Add status field to custom_pois table
ALTER TABLE custom_pois 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'private' CHECK (status IN ('private', 'pending', 'published', 'rejected'));

-- Add created_by field to main pois table
ALTER TABLE pois 
ADD COLUMN IF NOT EXISTS created_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pending_pois_vote_score ON pending_pois(vote_score);
CREATE INDEX IF NOT EXISTS idx_pending_pois_user_id ON pending_pois(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_poi_votes_user ON pending_poi_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_pois_status ON custom_pois(status);

-- Create or replace function (might already exist from other tables)
-- Using IF NOT EXISTS pattern for the function
DO $$ 
BEGIN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $func$ language 'plpgsql';
EXCEPTION 
    WHEN duplicate_function THEN NULL;
END $$;

-- Apply trigger to pending_pois table
DROP TRIGGER IF EXISTS update_pending_pois_updated_at ON pending_pois;
CREATE TRIGGER update_pending_pois_updated_at 
BEFORE UPDATE ON pending_pois 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to pending_poi_votes table
DROP TRIGGER IF EXISTS update_pending_poi_votes_updated_at ON pending_poi_votes;
CREATE TRIGGER update_pending_poi_votes_updated_at 
BEFORE UPDATE ON pending_poi_votes 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();