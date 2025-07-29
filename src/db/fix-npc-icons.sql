-- Update any POIs that have type 'npc' but don't have the skull icon
UPDATE pois 
SET icon = NULL, custom_icon = NULL
WHERE type = 'npc';