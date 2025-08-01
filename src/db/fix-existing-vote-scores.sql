-- Fix existing proposal vote scores that may have been double-counted

UPDATE change_proposals cp
SET vote_score = (
  SELECT COUNT(*) FILTER (WHERE vote = 1) - COUNT(*) FILTER (WHERE vote = -1)
  FROM change_proposal_votes cpv
  WHERE cpv.proposal_id = cp.id
)
WHERE cp.status = 'pending';

-- Show the updated scores
SELECT 
  cp.id,
  cp.change_type,
  cp.proposed_data->>'name' as poi_name,
  cp.vote_score,
  (SELECT COUNT(*) FILTER (WHERE vote = 1) FROM change_proposal_votes WHERE proposal_id = cp.id) as upvotes,
  (SELECT COUNT(*) FILTER (WHERE vote = -1) FROM change_proposal_votes WHERE proposal_id = cp.id) as downvotes
FROM change_proposals cp
WHERE cp.status = 'pending'
ORDER BY cp.created_at DESC;