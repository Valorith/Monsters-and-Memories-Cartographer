-- Create url_mappings table for caching wiki URL types
CREATE TABLE IF NOT EXISTS url_mappings (
    url TEXT PRIMARY KEY,
    url_type VARCHAR(20) NOT NULL CHECK (url_type IN ('item', 'list', 'npc', 'unknown')),
    title TEXT,
    last_verified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confidence_score DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_url_mappings_type ON url_mappings(url_type);
CREATE INDEX IF NOT EXISTS idx_url_mappings_confidence ON url_mappings(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_url_mappings_verified ON url_mappings(last_verified);

-- Add comments
COMMENT ON TABLE url_mappings IS 'Stores wiki URL type mappings for faster item import processing';
COMMENT ON COLUMN url_mappings.url IS 'Full wiki URL (primary key)';
COMMENT ON COLUMN url_mappings.url_type IS 'Type of content: item, list, npc, or unknown';
COMMENT ON COLUMN url_mappings.title IS 'Page title for display purposes';
COMMENT ON COLUMN url_mappings.confidence_score IS 'Confidence level 0-1 based on verification count';