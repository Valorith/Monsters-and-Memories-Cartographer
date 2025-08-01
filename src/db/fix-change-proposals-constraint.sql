-- Drop the existing constraint that's causing issues
ALTER TABLE change_proposals 
DROP CONSTRAINT IF EXISTS unique_active_proposal;

-- Add a new constraint that only enforces uniqueness for pending proposals
-- This allows a user to have one pending proposal per target, but multiple resolved ones
ALTER TABLE change_proposals 
ADD CONSTRAINT unique_pending_proposal 
UNIQUE (change_type, target_type, target_id, proposer_id) 
WHERE status = 'pending';

-- Also add a constraint to prevent multiple approved proposals for the same target
-- (regardless of proposer)
ALTER TABLE change_proposals 
ADD CONSTRAINT unique_approved_target 
UNIQUE (change_type, target_type, target_id) 
WHERE status = 'approved';