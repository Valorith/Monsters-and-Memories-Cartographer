-- Update the poi_types table to allow 'iconify' as an icon type

-- First drop the existing constraint
ALTER TABLE poi_types 
DROP CONSTRAINT IF EXISTS poi_types_icon_type_check;

-- Add the new constraint that includes 'iconify'
ALTER TABLE poi_types 
ADD CONSTRAINT poi_types_icon_type_check 
CHECK (icon_type IN ('emoji', 'upload', 'fontawesome', 'iconify'));

-- Update any existing fontawesome types to iconify
UPDATE poi_types 
SET icon_type = 'iconify' 
WHERE icon_type = 'fontawesome';