-- Add admin_id column to xp_history table to track who made admin adjustments
ALTER TABLE xp_history 
ADD COLUMN IF NOT EXISTS admin_id INTEGER REFERENCES users(id);

-- Add index for admin tracking
CREATE INDEX IF NOT EXISTS idx_xp_history_admin_id ON xp_history(admin_id);