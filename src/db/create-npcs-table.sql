-- Create NPCs table
-- Create sequence for npcid
CREATE SEQUENCE IF NOT EXISTS npcs_npcid_seq START WITH 1001;

CREATE TABLE IF NOT EXISTS npcs (
    id SERIAL PRIMARY KEY,
    npcid INTEGER NOT NULL DEFAULT nextval('npcs_npcid_seq') UNIQUE,
    npc_type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    loot INTEGER[], -- Array of item IDs
    hp INTEGER DEFAULT 0,
    mp INTEGER DEFAULT 0,
    ac INTEGER DEFAULT 0,
    str INTEGER DEFAULT 0,
    sta INTEGER DEFAULT 0,
    agi INTEGER DEFAULT 0,
    dex INTEGER DEFAULT 0,
    wis INTEGER DEFAULT 0,
    int INTEGER DEFAULT 0,
    cha INTEGER DEFAULT 0,
    attack_speed DECIMAL(3,1) DEFAULT 0,
    min_dmg INTEGER DEFAULT 0,
    max_dmg INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on npcid for faster lookups
CREATE INDEX IF NOT EXISTS idx_npcs_npcid ON npcs(npcid);

-- Create index on name for faster searches
CREATE INDEX IF NOT EXISTS idx_npcs_name ON npcs(name);

-- Create index on npc_type for filtering
CREATE INDEX IF NOT EXISTS idx_npcs_type ON npcs(npc_type);

-- Create index on level for filtering
CREATE INDEX IF NOT EXISTS idx_npcs_level ON npcs(level);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_npcs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_npcs_updated_at_trigger
    BEFORE UPDATE ON npcs
    FOR EACH ROW
    EXECUTE FUNCTION update_npcs_updated_at();