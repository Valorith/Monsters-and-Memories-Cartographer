-- Add trigger to recalculate donation tier when a donation is unmatched (user_id set to NULL)
-- This ensures user tiers are updated when donations are unlinked from users

-- Function to handle donation unmatch (when user_id is set to NULL)
CREATE OR REPLACE FUNCTION update_user_donation_tier_on_unmatch()
RETURNS TRIGGER AS $$
DECLARE
  new_tier_id INTEGER;
  total_amount DECIMAL(10, 2);
BEGIN
  -- Only process if we're changing from a non-null user_id to null
  IF OLD.user_id IS NOT NULL AND NEW.user_id IS NULL THEN
    -- Calculate total donations for the old user
    SELECT COALESCE(SUM(amount), 0.00) INTO total_amount
    FROM donations
    WHERE user_id = OLD.user_id;
    
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
      last_donation_date = (
        SELECT MAX(timestamp) 
        FROM donations 
        WHERE user_id = OLD.user_id
      )
    WHERE id = OLD.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for donation unmatch
DROP TRIGGER IF EXISTS update_donation_tier_on_donation_unmatch ON donations;
CREATE TRIGGER update_donation_tier_on_donation_unmatch
  BEFORE UPDATE ON donations
  FOR EACH ROW
  WHEN (OLD.user_id IS NOT NULL AND NEW.user_id IS NULL)
  EXECUTE FUNCTION update_user_donation_tier_on_unmatch();