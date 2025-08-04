-- Fix the recalculate_all_donation_tiers function to handle users with no donations

CREATE OR REPLACE FUNCTION recalculate_all_donation_tiers()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  total_amount DECIMAL(10, 2);
  new_tier_id INTEGER;
BEGIN
  -- Loop through ALL users who have ever had a donation tier or have donations
  FOR user_record IN 
    SELECT DISTINCT u.id as user_id 
    FROM users u
    WHERE u.current_donation_tier_id IS NOT NULL 
       OR u.total_donated > 0
       OR EXISTS (SELECT 1 FROM donations d WHERE d.user_id = u.id)
  LOOP
    -- Calculate total donations for each user
    SELECT COALESCE(SUM(amount), 0.00) INTO total_amount
    FROM donations
    WHERE user_id = user_record.user_id;
    
    -- Find the highest tier the user qualifies for (will be NULL if total is 0)
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
      last_donation_date = CASE 
        WHEN total_amount = 0 THEN NULL
        ELSE last_donation_date
      END
    WHERE id = user_record.user_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Quick fix for your specific user - run this with your user ID
-- UPDATE users 
-- SET total_donated = 0, 
--     current_donation_tier_id = NULL,
--     last_donation_date = NULL
-- WHERE id = YOUR_USER_ID;