-- Add block column to items table
ALTER TABLE items 
ADD COLUMN block INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN items.block IS 'Block chance or block amount provided by the item';