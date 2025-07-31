-- Revert POI types back to emoji icons since they work cross-platform
-- Using emojis that are well-supported on both Windows and Mac

UPDATE poi_types 
SET icon_type = 'emoji', icon_value = '🪵' 
WHERE LOWER(name) = 'lumberjack';
-- Alternative if wood emoji doesn't work: 🌲 (tree) or 🪓 (axe)

UPDATE poi_types 
SET icon_type = 'emoji', icon_value = '🎣' 
WHERE LOWER(name) = 'fishing';

UPDATE poi_types 
SET icon_type = 'emoji', icon_value = '🔨' 
WHERE LOWER(name) = 'blacksmith';

UPDATE poi_types 
SET icon_type = 'emoji', icon_value = '🧵' 
WHERE LOWER(name) = 'tailoring';
-- Alternative if thread doesn't work: ✂️ (scissors) or 🪡 (sewing needle)

UPDATE poi_types 
SET icon_type = 'emoji', icon_value = '🔥' 
WHERE LOWER(name) = 'smelting';

UPDATE poi_types 
SET icon_type = 'emoji', icon_value = '💬' 
WHERE LOWER(name) = 'quest npc';
-- Alternative: ❗ (exclamation) or 🗣️ (speaking head)

-- Update other common types to well-supported emojis
UPDATE poi_types SET icon_type = 'emoji', icon_value = '🏛️' WHERE LOWER(name) = 'landmark';
UPDATE poi_types SET icon_type = 'emoji', icon_value = '❗' WHERE LOWER(name) = 'quest';
UPDATE poi_types SET icon_type = 'emoji', icon_value = '💰' WHERE LOWER(name) = 'merchant';
UPDATE poi_types SET icon_type = 'emoji', icon_value = '👤' WHERE LOWER(name) = 'npc';
UPDATE poi_types SET icon_type = 'emoji', icon_value = '⚔️' WHERE LOWER(name) = 'dungeon';