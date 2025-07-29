-- Update default icons for point connectors to chain link emoji
ALTER TABLE point_connectors 
  ALTER COLUMN from_icon SET DEFAULT '🔗',
  ALTER COLUMN to_icon SET DEFAULT '🔗';

-- Update existing blue circle icons to chain link
UPDATE point_connectors 
SET from_icon = '🔗' 
WHERE from_icon = '🔵';

UPDATE point_connectors 
SET to_icon = '🔗' 
WHERE to_icon = '🔵';