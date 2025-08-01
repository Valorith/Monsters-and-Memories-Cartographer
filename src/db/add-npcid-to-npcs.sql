-- Add npcid column to npcs table
ALTER TABLE npcs 
ADD COLUMN IF NOT EXISTS npcid INTEGER;

-- Create a sequence for npcid
CREATE SEQUENCE IF NOT EXISTS npcs_npcid_seq START WITH 1001;

-- Set default value for npcid
ALTER TABLE npcs 
ALTER COLUMN npcid SET DEFAULT nextval('npcs_npcid_seq');

-- Update existing rows with npcid values
UPDATE npcs 
SET npcid = 1000 + id 
WHERE npcid IS NULL;

-- Make npcid NOT NULL and UNIQUE after populating
ALTER TABLE npcs 
ALTER COLUMN npcid SET NOT NULL;

ALTER TABLE npcs 
ADD CONSTRAINT npcs_npcid_unique UNIQUE (npcid);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_npcs_npcid ON npcs(npcid);