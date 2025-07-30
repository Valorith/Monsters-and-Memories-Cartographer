-- Create XP history table to track all XP changes
CREATE TABLE IF NOT EXISTS xp_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    xp_change INTEGER NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    shown BOOLEAN DEFAULT FALSE
);

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_xp_history_user_shown ON xp_history(user_id, shown);

-- Add last_visit column to users table to track when they last visited the main page
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_visit TIMESTAMP DEFAULT CURRENT_TIMESTAMP;