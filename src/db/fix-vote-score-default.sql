-- Fix the default vote_score to be 0 instead of 1
-- Since we now explicitly add the proposer's vote to change_proposal_votes,
-- the vote_score should start at 0 and be calculated from actual votes

ALTER TABLE change_proposals 
ALTER COLUMN vote_score SET DEFAULT 0;

-- Also ensure the trigger exists and is properly set up
DROP TRIGGER IF EXISTS update_vote_score_on_vote ON change_proposal_votes;

CREATE TRIGGER update_vote_score_on_vote
AFTER INSERT OR UPDATE OR DELETE ON change_proposal_votes
FOR EACH ROW EXECUTE FUNCTION update_proposal_vote_score();

-- Fix any existing proposals that might have incorrect scores
UPDATE change_proposals cp
SET vote_score = (
    SELECT COALESCE(SUM(vote), 0)
    FROM change_proposal_votes
    WHERE proposal_id = cp.id
)
WHERE cp.status = 'pending';