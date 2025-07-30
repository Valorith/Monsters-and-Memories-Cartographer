-- Add share_code column to custom_poi_shares table
ALTER TABLE custom_poi_shares 
ADD COLUMN IF NOT EXISTS share_code VARCHAR(50);

-- Add index for faster share code lookups
CREATE INDEX IF NOT EXISTS idx_share_code ON custom_poi_shares(share_code);

-- Add constraint to ensure share codes are unique (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_share_code') THEN
        ALTER TABLE custom_poi_shares ADD CONSTRAINT unique_share_code UNIQUE (share_code);
    END IF;
END $$;