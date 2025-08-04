-- Create donation_tiers table for managing donation badge tiers
CREATE TABLE IF NOT EXISTS donation_tiers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  required_amount DECIMAL(10, 2) NOT NULL,
  badge_color VARCHAR(7) NOT NULL, -- Hex color like #FFD700
  badge_icon VARCHAR(50), -- Optional emoji or icon
  tier_order INTEGER NOT NULL, -- For sorting tiers (1 = lowest, higher = better)
  description TEXT,
  perks TEXT[], -- Array of perk descriptions
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add unique constraint on tier_order for active tiers
CREATE UNIQUE INDEX idx_donation_tiers_order_active ON donation_tiers(tier_order) WHERE is_active = true;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_donation_tiers_amount ON donation_tiers(required_amount);
CREATE INDEX IF NOT EXISTS idx_donation_tiers_active ON donation_tiers(is_active);

-- Add donation tier fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS current_donation_tier_id INTEGER REFERENCES donation_tiers(id),
ADD COLUMN IF NOT EXISTS total_donated DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS last_donation_date TIMESTAMP;

-- Create index for users with donation tiers
CREATE INDEX IF NOT EXISTS idx_users_donation_tier ON users(current_donation_tier_id) WHERE current_donation_tier_id IS NOT NULL;

-- Insert default donation tiers
INSERT INTO donation_tiers (name, required_amount, badge_color, badge_icon, tier_order, description, perks) 
VALUES 
  ('Bronze', 10.00, '#CD7F32', '🥉', 1, 'Bronze tier supporter', ARRAY['Bronze badge displayed next to username', 'Access to supporter chat']),
  ('Silver', 25.00, '#C0C0C0', '🥈', 2, 'Silver tier supporter', ARRAY['Silver badge displayed next to username', 'Access to supporter chat', 'Early access to new features']),
  ('Gold', 50.00, '#FFD700', '🥇', 3, 'Gold tier supporter', ARRAY['Gold badge displayed next to username', 'Access to supporter chat', 'Early access to new features', 'Custom POI icon colors']),
  ('Platinum', 100.00, '#E5E4E2', '💎', 4, 'Platinum tier supporter', ARRAY['Platinum badge displayed next to username', 'Access to supporter chat', 'Early access to new features', 'Custom POI icon colors', 'Priority support']),
  ('Diamond', 250.00, '#B9F2FF', '💠', 5, 'Diamond tier supporter', ARRAY['Diamond badge displayed next to username', 'Access to supporter chat', 'Early access to new features', 'Custom POI icon colors', 'Priority support', 'Custom profile badge'])
ON CONFLICT (name) DO NOTHING;

-- Function to update user donation tier based on total donations
CREATE OR REPLACE FUNCTION update_user_donation_tier()
RETURNS TRIGGER AS $$
DECLARE
  new_tier_id INTEGER;
  total_amount DECIMAL(10, 2);
BEGIN
  -- Calculate total donations for the user
  SELECT COALESCE(SUM(amount), 0.00) INTO total_amount
  FROM donations
  WHERE user_id = NEW.user_id;
  
  -- Find the highest tier the user qualifies for
  SELECT id INTO new_tier_id
  FROM donation_tiers
  WHERE required_amount <= total_amount
    AND is_active = true
  ORDER BY tier_order DESC
  LIMIT 1;
  
  -- Update user's donation info
  UPDATE users
  SET 
    total_donated = total_amount,
    current_donation_tier_id = new_tier_id,
    last_donation_date = NEW.timestamp
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to update donation tier when new donation is added
DROP TRIGGER IF EXISTS update_donation_tier_on_donation ON donations;
CREATE TRIGGER update_donation_tier_on_donation
  AFTER INSERT OR UPDATE ON donations
  FOR EACH ROW
  WHEN (NEW.user_id IS NOT NULL)
  EXECUTE FUNCTION update_user_donation_tier();

-- Function to recalculate all user donation tiers (for maintenance)
CREATE OR REPLACE FUNCTION recalculate_all_donation_tiers()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  total_amount DECIMAL(10, 2);
  new_tier_id INTEGER;
BEGIN
  FOR user_record IN SELECT DISTINCT user_id FROM donations WHERE user_id IS NOT NULL
  LOOP
    -- Calculate total donations for each user
    SELECT COALESCE(SUM(amount), 0.00) INTO total_amount
    FROM donations
    WHERE user_id = user_record.user_id;
    
    -- Find the highest tier the user qualifies for
    SELECT id INTO new_tier_id
    FROM donation_tiers
    WHERE required_amount <= total_amount
      AND is_active = true
    ORDER BY tier_order DESC
    LIMIT 1;
    
    -- Update user's donation info
    UPDATE users
    SET 
      total_donated = total_amount,
      current_donation_tier_id = new_tier_id
    WHERE id = user_record.user_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Add update timestamp trigger for donation_tiers
DROP TRIGGER IF EXISTS update_donation_tiers_updated_at ON donation_tiers;
CREATE TRIGGER update_donation_tiers_updated_at BEFORE UPDATE ON donation_tiers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();