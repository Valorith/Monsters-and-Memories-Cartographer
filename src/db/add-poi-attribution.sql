-- Add attribution fields to POIs table if they don't exist
ALTER TABLE pois 
ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS created_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_pois_created_by_user_id ON pois(created_by_user_id);

-- For future: we should update existing POIs to use user IDs where possible