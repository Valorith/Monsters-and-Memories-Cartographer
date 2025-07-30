-- Add unique constraint to nickname column
-- First, let's check for any existing duplicates (case-insensitive)
DO $$
BEGIN
    -- Check if there are any duplicate nicknames (case-insensitive)
    IF EXISTS (
        SELECT LOWER(nickname), COUNT(*) 
        FROM users 
        WHERE nickname IS NOT NULL 
        GROUP BY LOWER(nickname) 
        HAVING COUNT(*) > 1
    ) THEN
        RAISE NOTICE 'Duplicate nicknames found. They will need to be resolved manually.';
    END IF;
END $$;

-- Create a unique index on lowercase nickname to ensure case-insensitive uniqueness
-- This allows NULL values but ensures non-NULL values are unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_nickname_unique_lower 
ON users (LOWER(nickname)) 
WHERE nickname IS NOT NULL;