-- Add welcome message table for storing customizable welcome messages
CREATE TABLE IF NOT EXISTS welcome_messages (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add acknowledged_at column to user_warnings table
ALTER TABLE user_warnings 
ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP DEFAULT NULL;

-- Create index for faster lookup of unacknowledged warnings
CREATE INDEX IF NOT EXISTS idx_user_warnings_unacknowledged 
ON user_warnings(user_id) 
WHERE acknowledged_at IS NULL;

-- Insert default welcome message (optional)
-- INSERT INTO welcome_messages (message, created_by) 
-- VALUES ('Welcome to MMC! Explore the map and discover amazing places.', 1);