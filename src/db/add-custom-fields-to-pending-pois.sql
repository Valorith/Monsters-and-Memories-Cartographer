-- Add missing custom POI fields to pending_pois table
ALTER TABLE pending_pois 
ADD COLUMN IF NOT EXISTS icon_size INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS label_visible BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS label_position VARCHAR(10) DEFAULT 'bottom',
ADD COLUMN IF NOT EXISTS custom_icon VARCHAR(10);