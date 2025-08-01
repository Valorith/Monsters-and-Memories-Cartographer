-- Remove dropped_by column from items table
ALTER TABLE items DROP COLUMN IF EXISTS dropped_by;

-- Remove the index if it exists
DROP INDEX IF EXISTS idx_items_dropped_by;