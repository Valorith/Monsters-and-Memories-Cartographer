-- Performance optimization indexes for MMC database

-- User-related indexes
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_xp ON users(xp DESC);

-- Custom POIs indexes
CREATE INDEX IF NOT EXISTS idx_custom_pois_user_id ON custom_pois(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_pois_map_id ON custom_pois(map_id);
CREATE INDEX IF NOT EXISTS idx_custom_pois_status ON custom_pois(status);
CREATE INDEX IF NOT EXISTS idx_custom_pois_created_at ON custom_pois(created_at DESC);

-- Pending POIs indexes
CREATE INDEX IF NOT EXISTS idx_pending_pois_user_id ON pending_pois(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_pois_map_id ON pending_pois(map_id);
CREATE INDEX IF NOT EXISTS idx_pending_pois_vote_score ON pending_pois(vote_score DESC);
CREATE INDEX IF NOT EXISTS idx_pending_pois_created_at ON pending_pois(created_at DESC);

-- Pending POI votes indexes
CREATE INDEX IF NOT EXISTS idx_pending_poi_votes_user_id ON pending_poi_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_poi_votes_pending_poi_id ON pending_poi_votes(pending_poi_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_custom_pois_user_map ON custom_pois(user_id, map_id);
CREATE INDEX IF NOT EXISTS idx_custom_pois_map_status ON custom_pois(map_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_poi_votes_poi_user ON pending_poi_votes(pending_poi_id, user_id);

-- XP history indexes
CREATE INDEX IF NOT EXISTS idx_xp_history_user_id ON xp_history(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_history_created_at ON xp_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_history_user_created ON xp_history(user_id, created_at DESC);

-- Session table index for faster lookups
CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);

-- Custom POI share indexes
CREATE INDEX IF NOT EXISTS idx_custom_poi_shares_poi_id ON custom_poi_shares(custom_poi_id);
CREATE INDEX IF NOT EXISTS idx_custom_poi_shares_shared_with ON custom_poi_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_custom_poi_shares_poi_user ON custom_poi_shares(custom_poi_id, shared_with_user_id);