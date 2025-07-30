-- Create XP configuration table for admin-adjustable values
CREATE TABLE IF NOT EXISTS xp_config (
    key VARCHAR(50) PRIMARY KEY,
    value INTEGER NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id)
);

-- Insert default XP values
INSERT INTO xp_config (key, value, description) VALUES
    ('poi_publish', 10, 'XP awarded when publishing a POI'),
    ('poi_pending_remove', -10, 'XP removed when removing a POI from pending state'),
    ('poi_approved', 20, 'XP awarded when a POI gets approved')
ON CONFLICT (key) DO NOTHING;