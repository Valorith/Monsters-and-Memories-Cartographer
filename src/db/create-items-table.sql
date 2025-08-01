-- Create items table if it doesn't exist
CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    icon_type VARCHAR(20) NOT NULL CHECK (icon_type IN ('emoji', 'iconify', 'fontawesome', 'upload')),
    icon_value TEXT NOT NULL,
    
    -- Stats
    str INTEGER DEFAULT 0,
    sta INTEGER DEFAULT 0,
    agi INTEGER DEFAULT 0,
    dex INTEGER DEFAULT 0,
    wis INTEGER DEFAULT 0,
    int INTEGER DEFAULT 0,
    cha INTEGER DEFAULT 0,
    
    -- Combat stats
    attack_speed DECIMAL(3,1) DEFAULT 0,
    health INTEGER DEFAULT 0,
    mana INTEGER DEFAULT 0,
    ac INTEGER DEFAULT 0,
    
    -- Item properties
    item_type VARCHAR(50),
    slot VARCHAR(50),
    description TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id)
);

-- Create index on name for faster searches
CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);

-- Create index on item_type for filtering
CREATE INDEX IF NOT EXISTS idx_items_type ON items(item_type);