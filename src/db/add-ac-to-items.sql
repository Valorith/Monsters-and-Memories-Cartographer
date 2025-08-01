-- Add ac column to items table
ALTER TABLE items
ADD COLUMN IF NOT EXISTS ac INTEGER DEFAULT 0;

-- Add comment to explain the column
COMMENT ON COLUMN items.ac IS 'Armor Class provided by this item';