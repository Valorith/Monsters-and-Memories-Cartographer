-- Create change proposals table for community voting on changes
CREATE TABLE IF NOT EXISTS change_proposals (
    id SERIAL PRIMARY KEY,
    
    -- Change type and target
    change_type VARCHAR(50) NOT NULL, -- 'add_item', 'add_npc', 'add_poi', 'edit_poi', 'edit_npc', 'edit_item', 'delete_poi', 'move_poi', 'add_loot', 'remove_loot'
    target_type VARCHAR(20) NOT NULL, -- 'poi', 'npc', 'item'
    target_id INTEGER, -- ID of the target entity (null for new additions)
    
    -- User who proposed the change
    proposer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Change data (flexible JSON to handle different change types)
    current_data JSONB, -- Current state (for edits/deletes)
    proposed_data JSONB NOT NULL, -- Proposed new state
    notes TEXT, -- Optional user notes explaining the change
    
    -- Voting data
    vote_score INTEGER DEFAULT 1, -- Starts at 1 (proposer's upvote)
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'withdrawn'
    
    -- Admin actions
    admin_id INTEGER REFERENCES users(id),
    admin_action VARCHAR(20), -- 'approved', 'rejected', 'edited'
    admin_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    
    -- Prevent duplicate active proposals
    CONSTRAINT unique_active_proposal UNIQUE (change_type, target_type, target_id, proposer_id, status)
);

-- Create indexes for performance
CREATE INDEX idx_change_proposals_status ON change_proposals(status);
CREATE INDEX idx_change_proposals_proposer ON change_proposals(proposer_id);
CREATE INDEX idx_change_proposals_target ON change_proposals(target_type, target_id);
CREATE INDEX idx_change_proposals_created ON change_proposals(created_at DESC);

-- Create votes table for change proposals
CREATE TABLE IF NOT EXISTS change_proposal_votes (
    id SERIAL PRIMARY KEY,
    proposal_id INTEGER NOT NULL REFERENCES change_proposals(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote INTEGER NOT NULL CHECK (vote IN (-1, 1)), -- -1 for downvote, 1 for upvote
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- One vote per user per proposal
    CONSTRAINT unique_proposal_vote UNIQUE (proposal_id, user_id)
);

-- Create index for vote lookups
CREATE INDEX idx_proposal_votes_proposal ON change_proposal_votes(proposal_id);
CREATE INDEX idx_proposal_votes_user ON change_proposal_votes(user_id);

-- Add XP config for approved changes
INSERT INTO xp_config (key, value, description) 
VALUES ('change_approved', 10, 'XP awarded when a proposed change is approved')
ON CONFLICT (key) DO NOTHING;