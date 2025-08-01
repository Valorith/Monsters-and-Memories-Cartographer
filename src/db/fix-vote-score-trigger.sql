-- Fix the vote score trigger to remove double counting
-- The proposer's vote is explicitly added to change_proposal_votes, 
-- so we don't need the implicit +1 in the trigger

CREATE OR REPLACE FUNCTION update_proposal_vote_score()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE change_proposals
  SET vote_score = (
    SELECT COALESCE(SUM(vote), 0)
    FROM change_proposal_votes
    WHERE proposal_id = COALESCE(NEW.proposal_id, OLD.proposal_id)
  )
  WHERE id = COALESCE(NEW.proposal_id, OLD.proposal_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- No need to recreate the trigger, just the function