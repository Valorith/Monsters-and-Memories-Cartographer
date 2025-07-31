-- Update POI types to use colored emoji-style icons that work cross-platform
-- These use Twemoji or Noto icon sets which are full-color SVG versions of emojis

-- Twemoji icons (Twitter's emoji as SVGs)
UPDATE poi_types 
SET icon_type = 'iconify', icon_value = 'twemoji:axe' 
WHERE LOWER(name) = 'lumberjack';

UPDATE poi_types 
SET icon_type = 'iconify', icon_value = 'twemoji:fishing-pole' 
WHERE LOWER(name) = 'fishing';

UPDATE poi_types 
SET icon_type = 'iconify', icon_value = 'twemoji:hammer' 
WHERE LOWER(name) = 'blacksmith';

UPDATE poi_types 
SET icon_type = 'iconify', icon_value = 'twemoji:thread' 
WHERE LOWER(name) = 'tailoring';

UPDATE poi_types 
SET icon_type = 'iconify', icon_value = 'twemoji:fire' 
WHERE LOWER(name) = 'smelting';

UPDATE poi_types 
SET icon_type = 'iconify', icon_value = 'twemoji:speech-balloon' 
WHERE LOWER(name) = 'quest npc';

-- Alternative: Use Noto (Google's emoji as SVGs)
-- UPDATE poi_types SET icon_type = 'iconify', icon_value = 'noto:axe' WHERE LOWER(name) = 'lumberjack';
-- UPDATE poi_types SET icon_type = 'iconify', icon_value = 'noto:fishing-pole' WHERE LOWER(name) = 'fishing';
-- UPDATE poi_types SET icon_type = 'iconify', icon_value = 'noto:hammer' WHERE LOWER(name) = 'blacksmith';
-- UPDATE poi_types SET icon_type = 'iconify', icon_value = 'noto:thread' WHERE LOWER(name) = 'tailoring';
-- UPDATE poi_types SET icon_type = 'iconify', icon_value = 'noto:fire' WHERE LOWER(name) = 'smelting';
-- UPDATE poi_types SET icon_type = 'iconify', icon_value = 'noto:speech-balloon' WHERE LOWER(name) = 'quest npc';

-- Alternative: Use OpenMoji (open source colored emojis)
-- UPDATE poi_types SET icon_type = 'iconify', icon_value = 'openmoji:axe' WHERE LOWER(name) = 'lumberjack';
-- UPDATE poi_types SET icon_type = 'iconify', icon_value = 'openmoji:fishing-pole' WHERE LOWER(name) = 'fishing';
-- UPDATE poi_types SET icon_type = 'iconify', icon_value = 'openmoji:hammer' WHERE LOWER(name) = 'blacksmith';
-- UPDATE poi_types SET icon_type = 'iconify', icon_value = 'openmoji:thread' WHERE LOWER(name) = 'tailoring';
-- UPDATE poi_types SET icon_type = 'iconify', icon_value = 'openmoji:fire' WHERE LOWER(name) = 'smelting';
-- UPDATE poi_types SET icon_type = 'iconify', icon_value = 'openmoji:speech-balloon' WHERE LOWER(name) = 'quest npc';