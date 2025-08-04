-- Update the donation matching function to also try matching by user's full name

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
  
  -- Try to match by full name if nickname match failed
  IF NEW.user_id IS NULL THEN
    SELECT id INTO NEW.user_id 
    FROM users 
    WHERE LOWER(name) = LOWER(NEW.from_name)
    LIMIT 1;
    
    IF NEW.user_id IS NOT NULL THEN
      NEW.matched_by = 'name';
    END IF;
  END IF;
  
  -- Try to match by email if previous matches failed and email is provided
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

-- Update the rematch function to also check name changes
CREATE OR REPLACE FUNCTION rematch_donations_on_user_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If nickname changed, try to match any unmatched donations
  IF OLD.nickname IS DISTINCT FROM NEW.nickname AND NEW.nickname IS NOT NULL THEN
    -- Match donations that have the new nickname
    UPDATE donations 
    SET user_id = NEW.id, 
        matched_by = 'nickname',
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id IS NULL 
      AND LOWER(from_name) = LOWER(NEW.nickname);
  END IF;
  
  -- If name changed, try to match any unmatched donations
  IF OLD.name IS DISTINCT FROM NEW.name AND NEW.name IS NOT NULL THEN
    -- Match donations that have the new name
    UPDATE donations 
    SET user_id = NEW.id, 
        matched_by = 'name',
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id IS NULL 
      AND LOWER(from_name) = LOWER(NEW.name);
  END IF;
  
  -- If email changed, try to match any unmatched donations
  IF OLD.email IS DISTINCT FROM NEW.email AND NEW.email IS NOT NULL THEN
    -- Match donations that have the new email
    UPDATE donations 
    SET user_id = NEW.id, 
        matched_by = 'email',
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id IS NULL 
      AND LOWER(email) = LOWER(NEW.email);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the trigger to use the new function name
DROP TRIGGER IF EXISTS rematch_donations_on_user_update ON users;
CREATE TRIGGER rematch_donations_on_user_update
  AFTER UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION rematch_donations_on_user_change();