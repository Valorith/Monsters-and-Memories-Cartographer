-- Add npcID and itemID columns to pois table
ALTER TABLE pois 
ADD COLUMN IF NOT EXISTS npc_id INTEGER,
ADD COLUMN IF NOT EXISTS item_id INTEGER;

-- Add foreign key constraints
ALTER TABLE pois
ADD CONSTRAINT fk_pois_npc_id 
  FOREIGN KEY (npc_id) 
  REFERENCES npcs(npcid) 
  ON DELETE SET NULL,
ADD CONSTRAINT fk_pois_item_id 
  FOREIGN KEY (item_id) 
  REFERENCES items(id) 
  ON DELETE SET NULL;

-- Add check constraint to ensure mutual exclusivity
ALTER TABLE pois
ADD CONSTRAINT check_npc_item_exclusive 
  CHECK (
    (npc_id IS NULL AND item_id IS NULL) OR
    (npc_id IS NOT NULL AND item_id IS NULL) OR
    (npc_id IS NULL AND item_id IS NOT NULL)
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pois_npc_id ON pois(npc_id);
CREATE INDEX IF NOT EXISTS idx_pois_item_id ON pois(item_id);

-- Also add to custom_pois table
ALTER TABLE custom_pois 
ADD COLUMN IF NOT EXISTS npc_id INTEGER,
ADD COLUMN IF NOT EXISTS item_id INTEGER;

-- Add foreign key constraints for custom_pois
ALTER TABLE custom_pois
ADD CONSTRAINT fk_custom_pois_npc_id 
  FOREIGN KEY (npc_id) 
  REFERENCES npcs(npcid) 
  ON DELETE SET NULL,
ADD CONSTRAINT fk_custom_pois_item_id 
  FOREIGN KEY (item_id) 
  REFERENCES items(id) 
  ON DELETE SET NULL;

-- Add check constraint to ensure mutual exclusivity for custom_pois
ALTER TABLE custom_pois
ADD CONSTRAINT check_custom_npc_item_exclusive 
  CHECK (
    (npc_id IS NULL AND item_id IS NULL) OR
    (npc_id IS NOT NULL AND item_id IS NULL) OR
    (npc_id IS NULL AND item_id IS NOT NULL)
  );

-- Create indexes for custom_pois
CREATE INDEX IF NOT EXISTS idx_custom_pois_npc_id ON custom_pois(npc_id);
CREATE INDEX IF NOT EXISTS idx_custom_pois_item_id ON custom_pois(item_id);