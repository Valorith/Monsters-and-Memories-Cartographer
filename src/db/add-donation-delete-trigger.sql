-- Add trigger to recalculate donation tier when a donation is deleted
-- This ensures user tiers are updated when donations are removed

-- Function to handle donation deletion
CREATE OR REPLACE FUNCTION update_user_donation_tier_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  new_tier_id INTEGER;
  total_amount DECIMAL(10, 2);
BEGIN
  -- Only process if the deleted donation had a user_id
  IF OLD.user_id IS NOT NULL THEN
    -- Calculate total donations for the user
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
      current_donation_tier_id = new_tier_id
    WHERE id = OLD.user_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for donation deletion
DROP TRIGGER IF EXISTS update_donation_tier_on_donation_delete ON donations;
CREATE TRIGGER update_donation_tier_on_donation_delete
  AFTER DELETE ON donations
  FOR EACH ROW
  WHEN (OLD.user_id IS NOT NULL)
  EXECUTE FUNCTION update_user_donation_tier_on_delete();