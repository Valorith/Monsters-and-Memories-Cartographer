-- Update the items size check constraint to include 'Tiny' as a valid size
-- First drop the existing constraint
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_size_check;

-- Add the new constraint with 'Tiny' included
ALTER TABLE items ADD CONSTRAINT items_size_check 
CHECK (size IN ('Tiny', 'Small', 'Medium', 'Large', 'Giant'));

-- Update any existing NULL sizes to 'Medium' as default
UPDATE items SET size = 'Medium' WHERE size IS NULL;