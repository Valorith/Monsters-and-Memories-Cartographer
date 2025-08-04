-- Create System Test POIs for testing the share functionality
-- This script creates a System user and some test POIs that can be shared

-- First ensure required columns exist
ALTER TABLE custom_pois ADD COLUMN IF NOT EXISTS type_id INTEGER REFERENCES poi_types(id);
ALTER TABLE custom_pois ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';

-- First, check if System user exists, if not create it
INSERT INTO users (id, google_id, email, name, nickname, is_admin, created_at, last_login)
VALUES (999999, 'system-test-user', 'system@mmc.test', 'System', 'System', false, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    nickname = EXCLUDED.nickname;

-- Delete any existing test POIs to ensure clean state
DELETE FROM custom_pois WHERE user_id = 999999;

-- Create test POIs for the System user on the default map (id: 1)
-- Important: Only ONE POI can have a specific share code at a time
-- We'll create one main test POI with the SYSTEST001 code

-- Main test POI with the share code
INSERT INTO custom_pois (user_id, map_id, name, description, x, y, type_id, share_code, share_code_created_at, share_code_revoked, created_at)
VALUES (
    999999, 
    1, 
    'System Test Location', 
    'This is a test POI shared by the System account. It demonstrates the POI sharing functionality for testing purposes.',
    650, 
    650, 
    13, -- Landmark type 
    'SYSTEST001',
    NOW(),
    false,
    NOW()
);

-- Additional test POIs without share codes (to show they won't be shared)
INSERT INTO custom_pois (user_id, map_id, name, description, x, y, type_id, created_at)
VALUES 
(
    999999, 
    1, 
    'Private Test Combat Zone', 
    'This POI is owned by System but not shared.',
    500, 
    500, 
    11, -- Combat NPC type (no Dungeon type exists) 
    NOW()
),
(
    999999, 
    1, 
    'Private Test Merchant', 
    'This POI is owned by System but not shared.',
    600, 
    600, 
    14, -- Merchant type 
    NOW()
);

-- Output confirmation
DO $$
BEGIN
    RAISE NOTICE 'System test POIs created successfully. Share code: SYSTEST001';
    RAISE NOTICE 'Admins can use this code to test the POI sharing functionality.';
END $$;