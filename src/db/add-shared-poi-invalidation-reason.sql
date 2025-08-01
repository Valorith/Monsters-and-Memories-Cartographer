-- Add invalidation reason to shared POIs to distinguish between revoked and published

-- Add column to track why a share was deactivated
ALTER TABLE shared_pois 
ADD COLUMN IF NOT EXISTS invalidation_reason VARCHAR(50) DEFAULT 'revoked';

-- Add column to store the published POI details for invalidated shares
ALTER TABLE shared_pois 
ADD COLUMN IF NOT EXISTS published_poi_data JSONB;

-- Update existing inactive shares to have 'revoked' reason
UPDATE shared_pois 
SET invalidation_reason = 'revoked' 
WHERE is_active = false AND invalidation_reason IS NULL;

-- Also add similar fields to custom_poi_shares table for consistency
ALTER TABLE custom_poi_shares 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE custom_poi_shares 
ADD COLUMN IF NOT EXISTS invalidation_reason VARCHAR(50) DEFAULT 'revoked';

ALTER TABLE custom_poi_shares 
ADD COLUMN IF NOT EXISTS published_poi_data JSONB;

-- Update existing shares to be active by default
UPDATE custom_poi_shares 
SET is_active = true 
WHERE is_active IS NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_shared_pois_invalidation_reason ON shared_pois(invalidation_reason);
CREATE INDEX IF NOT EXISTS idx_custom_poi_shares_invalidation_reason ON custom_poi_shares(invalidation_reason);
CREATE INDEX IF NOT EXISTS idx_custom_poi_shares_is_active ON custom_poi_shares(is_active);