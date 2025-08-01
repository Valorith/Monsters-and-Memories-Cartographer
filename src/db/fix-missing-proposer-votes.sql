-- Add missing proposer votes for existing proposals
-- This ensures every proposal has the proposer's implicit upvote

INSERT INTO change_proposal_votes (proposal_id, user_id, vote)
SELECT cp.id, cp.proposer_id, 1
FROM change_proposals cp
WHERE NOT EXISTS (
    SELECT 1 
    FROM change_proposal_votes cpv 
    WHERE cpv.proposal_id = cp.id 
    AND cpv.user_id = cp.proposer_id
)
AND cp.status = 'pending';

-- Update the vote scores to reflect the added votes
UPDATE change_proposals cp
SET vote_score = (
    SELECT COUNT(*) FILTER (WHERE vote = 1) - COUNT(*) FILTER (WHERE vote = -1)
    FROM change_proposal_votes
    WHERE proposal_id = cp.id
)
WHERE cp.status = 'pending';