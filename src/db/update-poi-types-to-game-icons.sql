-- Update POI types to use colored game-icons for better cross-platform support
-- These icons will display consistently on all operating systems

UPDATE poi_types 
SET icon_type = 'iconify', icon_value = 'game-icons:wood-axe' 
WHERE LOWER(name) = 'lumberjack';

UPDATE poi_types 
SET icon_type = 'iconify', icon_value = 'game-icons:fishing-pole' 
WHERE LOWER(name) = 'fishing';

UPDATE poi_types 
SET icon_type = 'iconify', icon_value = 'game-icons:anvil-impact' 
WHERE LOWER(name) = 'blacksmith';

UPDATE poi_types 
SET icon_type = 'iconify', icon_value = 'game-icons:spool' 
WHERE LOWER(name) = 'tailoring';

UPDATE poi_types 
SET icon_type = 'iconify', icon_value = 'game-icons:molten-metal' 
WHERE LOWER(name) = 'smelting';

UPDATE poi_types 
SET icon_type = 'iconify', icon_value = 'game-icons:conversation' 
WHERE LOWER(name) = 'quest npc';

-- Optional: Update other common POI types to game-icons for consistency
-- Uncomment these if you want to update all POI types to use game-icons

-- UPDATE poi_types 
-- SET icon_type = 'iconify', icon_value = 'game-icons:ancient-ruins' 
-- WHERE LOWER(name) = 'landmark';

-- UPDATE poi_types 
-- SET icon_type = 'iconify', icon_value = 'game-icons:exclamation-marks' 
-- WHERE LOWER(name) = 'quest';

-- UPDATE poi_types 
-- SET icon_type = 'iconify', icon_value = 'game-icons:cash' 
-- WHERE LOWER(name) = 'merchant';

-- UPDATE poi_types 
-- SET icon_type = 'iconify', icon_value = 'game-icons:death-skull' 
-- WHERE LOWER(name) = 'npc';

-- UPDATE poi_types 
-- SET icon_type = 'iconify', icon_value = 'game-icons:dungeon-gate' 
-- WHERE LOWER(name) = 'dungeon';