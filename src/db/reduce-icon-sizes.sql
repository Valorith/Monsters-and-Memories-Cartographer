-- Reduce all existing icon sizes by 30% (multiply by 0.7)

-- Update POI icon sizes
UPDATE pois 
SET icon_size = ROUND(icon_size * 0.7)
WHERE icon_size IS NOT NULL;

-- Update point connector icon sizes
UPDATE point_connectors 
SET 
  from_icon_size = ROUND(from_icon_size * 0.7),
  to_icon_size = ROUND(to_icon_size * 0.7)
WHERE from_icon_size IS NOT NULL OR to_icon_size IS NOT NULL;

-- Update zone connector icon sizes
UPDATE zone_connectors 
SET 
  from_icon_size = ROUND(from_icon_size * 0.7),
  to_icon_size = ROUND(to_icon_size * 0.7)
WHERE from_icon_size IS NOT NULL OR to_icon_size IS NOT NULL;

-- Update custom POI icon sizes
UPDATE custom_pois 
SET icon_size = ROUND(icon_size * 0.7)
WHERE icon_size IS NOT NULL;