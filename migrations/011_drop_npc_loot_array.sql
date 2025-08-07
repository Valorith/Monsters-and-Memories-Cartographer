-- Migration: Drop the loot array column from npcs table
-- This completes the migration to junction table approach

-- Drop the loot column from npcs table
ALTER TABLE npcs DROP COLUMN IF EXISTS loot;

-- Drop existing triggers first (if they exist)
DROP TRIGGER IF EXISTS npc_loot_insert_trigger ON npc_loot;
DROP TRIGGER IF EXISTS npc_loot_update_trigger ON npc_loot;
DROP TRIGGER IF EXISTS npc_loot_delete_trigger ON npc_loot;

-- Add a trigger to refresh the materialized view when npc_loot changes
CREATE OR REPLACE FUNCTION refresh_item_drop_sources_trigger()
RETURNS trigger AS $$
BEGIN
  -- Use a deferred refresh to avoid refreshing on every row in a batch
  PERFORM pg_notify('refresh_item_drop_sources', '');
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for insert, update, and delete
CREATE TRIGGER npc_loot_insert_trigger
AFTER INSERT ON npc_loot
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_item_drop_sources_trigger();

CREATE TRIGGER npc_loot_update_trigger
AFTER UPDATE ON npc_loot
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_item_drop_sources_trigger();

CREATE TRIGGER npc_loot_delete_trigger
AFTER DELETE ON npc_loot
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_item_drop_sources_trigger();

-- Add index on npcs table for common queries
CREATE INDEX IF NOT EXISTS idx_npcs_level_name ON npcs(level DESC, name ASC);

-- Add comment
COMMENT ON TABLE npcs IS 'NPC definitions. Loot is now stored in the npc_loot junction table for better performance.';