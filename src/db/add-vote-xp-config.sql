-- Add XP configuration for voting on change proposals
INSERT INTO xp_config (key, value, description) VALUES
    ('proposal_vote', 2, 'XP awarded when voting on a change proposal for the first time')
ON CONFLICT (key) DO NOTHING;