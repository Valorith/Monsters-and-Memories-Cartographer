-- Migration: Create npc_loot junction table for better performance
-- This creates a junction table to replace the array-based loot storage

-- Create the junction table
CREATE TABLE IF NOT EXISTS npc_loot (
    id SERIAL PRIMARY KEY,
    npc_id INTEGER NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    drop_rate DECIMAL(5,2) DEFAULT 100.00 CHECK (drop_rate >= 0 AND drop_rate <= 100),
    quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(npc_id, item_id)
);

-- Create indexes for performance
CREATE INDEX idx_npc_loot_npc_id ON npc_loot(npc_id);
CREATE INDEX idx_npc_loot_item_id ON npc_loot(item_id);
CREATE INDEX idx_npc_loot_drop_rate ON npc_loot(drop_rate) WHERE drop_rate < 100;

-- Add comment explaining the table
COMMENT ON TABLE npc_loot IS 'Junction table for NPC loot relationships, replacing array-based storage for better performance';
COMMENT ON COLUMN npc_loot.drop_rate IS 'Drop rate percentage (0-100), default 100 for guaranteed drops';
COMMENT ON COLUMN npc_loot.quantity IS 'Number of items dropped, default 1';

-- Populate the junction table from existing array data
INSERT INTO npc_loot (npc_id, item_id)
SELECT n.id, unnest(n.loot)
FROM npcs n
WHERE n.loot IS NOT NULL AND array_length(n.loot, 1) > 0
ON CONFLICT (npc_id, item_id) DO NOTHING;

-- Create a view for easy querying of NPCs with their loot
CREATE OR REPLACE VIEW npc_loot_details AS
SELECT 
    n.id as npc_id,
    n.npcid,
    n.name as npc_name,
    n.npc_type,
    n.level,
    nl.item_id,
    i.name as item_name,
    i.icon_type,
    i.icon_value,
    nl.drop_rate,
    nl.quantity
FROM npcs n
INNER JOIN npc_loot nl ON n.id = nl.npc_id
INNER JOIN items i ON nl.item_id = i.id
ORDER BY n.name, i.name;

-- Create a materialized view for fast reverse lookups (which NPCs drop an item)
CREATE MATERIALIZED VIEW IF NOT EXISTS item_drop_sources AS
SELECT 
    i.id as item_id,
    i.name as item_name,
    json_agg(
        json_build_object(
            'npc_id', n.id,
            'npc_name', n.name,
            'npc_type', n.npc_type,
            'level', n.level,
            'drop_rate', nl.drop_rate
        ) ORDER BY n.level DESC, n.name
    ) as dropped_by
FROM items i
INNER JOIN npc_loot nl ON i.id = nl.item_id
INNER JOIN npcs n ON nl.npc_id = n.id
GROUP BY i.id, i.name;

-- Create index on the materialized view
CREATE INDEX idx_item_drop_sources_item_id ON item_drop_sources(item_id);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_item_drop_sources()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY item_drop_sources;
END;
$$ LANGUAGE plpgsql;

-- Note: The original loot array column is intentionally NOT dropped yet
-- This allows for a gradual migration and rollback if needed