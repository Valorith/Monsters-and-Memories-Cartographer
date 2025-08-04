-- Create donations table to track Ko-fi donations
CREATE TABLE IF NOT EXISTS donations (
  id SERIAL PRIMARY KEY,
  -- Ko-fi webhook data fields
  kofi_transaction_id VARCHAR(255) UNIQUE NOT NULL,
  from_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  is_public BOOLEAN DEFAULT false,
  is_subscription BOOLEAN DEFAULT false,
  is_first_subscription_payment BOOLEAN DEFAULT false,
  subscription_id VARCHAR(255),
  tier_name VARCHAR(255),
  message TEXT,
  kofi_message_id VARCHAR(255),
  type VARCHAR(50) NOT NULL, -- 'Donation', 'Subscription', 'Commission', 'Shop Order'
  timestamp TIMESTAMP NOT NULL,
  
  -- User matching
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  matched_by VARCHAR(50), -- 'nickname', 'email', 'manual', null
  
  -- Metadata
  raw_webhook_data JSONB, -- Store complete webhook payload for reference
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_donations_user_id ON donations(user_id);
CREATE INDEX IF NOT EXISTS idx_donations_kofi_transaction_id ON donations(kofi_transaction_id);
CREATE INDEX IF NOT EXISTS idx_donations_from_name ON donations(LOWER(from_name));
CREATE INDEX IF NOT EXISTS idx_donations_email ON donations(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_donations_timestamp ON donations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_donations_type ON donations(type);

-- Add update timestamp trigger
DROP TRIGGER IF EXISTS update_donations_updated_at ON donations;
CREATE TRIGGER update_donations_updated_at BEFORE UPDATE ON donations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add function to match donations to users
CREATE OR REPLACE FUNCTION match_donation_to_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Try to match by nickname (case insensitive)
  IF NEW.user_id IS NULL THEN
    SELECT id INTO NEW.user_id 
    FROM users 
    WHERE LOWER(nickname) = LOWER(NEW.from_name)
    LIMIT 1;
    
    IF NEW.user_id IS NOT NULL THEN
      NEW.matched_by = 'nickname';
    END IF;
  END IF;
  
  -- Try to match by email if nickname match failed and email is provided
  IF NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT id INTO NEW.user_id 
    FROM users 
    WHERE LOWER(email) = LOWER(NEW.email)
    LIMIT 1;
    
    IF NEW.user_id IS NOT NULL THEN
      NEW.matched_by = 'email';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to automatically match donations to users on insert
DROP TRIGGER IF EXISTS match_donation_on_insert ON donations;
CREATE TRIGGER match_donation_on_insert
  BEFORE INSERT ON donations
  FOR EACH ROW
  EXECUTE FUNCTION match_donation_to_user();

-- Add trigger to re-match donations when user nicknames are updated
CREATE OR REPLACE FUNCTION rematch_donations_on_nickname_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If nickname changed, try to match any unmatched donations
  IF OLD.nickname IS DISTINCT FROM NEW.nickname THEN
    -- Match donations that have the new nickname
    UPDATE donations 
    SET user_id = NEW.id, 
        matched_by = 'nickname',
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id IS NULL 
      AND LOWER(from_name) = LOWER(NEW.nickname);
    
    -- Unmatch donations that had the old nickname (if any)
    IF OLD.nickname IS NOT NULL THEN
      UPDATE donations 
      SET user_id = NULL, 
          matched_by = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = NEW.id 
        AND matched_by = 'nickname'
        AND LOWER(from_name) = LOWER(OLD.nickname);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to users table for nickname changes
DROP TRIGGER IF EXISTS rematch_donations_on_user_update ON users;
CREATE TRIGGER rematch_donations_on_user_update
  AFTER UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION rematch_donations_on_nickname_change();