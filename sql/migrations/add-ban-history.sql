-- Create ban history table to track all ban/unban events
CREATE TABLE IF NOT EXISTS user_ban_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('ban', 'unban')),
    reason TEXT,
    admin_id INTEGER REFERENCES users(id) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_ban_history_user_id ON user_ban_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ban_history_created_at ON user_ban_history(created_at);

-- Add any existing bans to history
INSERT INTO user_ban_history (user_id, action, reason, admin_id, created_at)
SELECT 
    id as user_id,
    'ban' as action,
    ban_reason as reason,
    COALESCE(banned_by, id) as admin_id,  -- Use self if banned_by is null
    banned_at as created_at
FROM users
WHERE is_banned = true 
  AND banned_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_ban_history 
    WHERE user_ban_history.user_id = users.id 
      AND user_ban_history.action = 'ban'
      AND user_ban_history.created_at = users.banned_at
  );