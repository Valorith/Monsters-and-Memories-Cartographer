-- Migrate pending POIs to the new change proposals system
-- This migration transfers all pending POI data to the unified voting system

-- First, migrate all pending POIs to change_proposals table
INSERT INTO change_proposals (
    change_type,
    target_type,
    target_id,
    proposer_id,
    current_data,
    proposed_data,
    notes,
    vote_score,
    status,
    created_at
)
SELECT 
    'add_poi' as change_type,
    'poi' as target_type,
    NULL as target_id, -- New POIs don't have a target ID
    pp.user_id as proposer_id,
    NULL as current_data, -- New POIs don't have current data
    jsonb_build_object(
        'map_id', pp.map_id,
        'name', pp.name,
        'description', pp.description,
        'x', pp.x,
        'y', pp.y,
        'type_id', pp.type_id,
        'icon', pp.icon,
        'icon_size', pp.icon_size,
        'label_visible', pp.label_visible,
        'label_position', pp.label_position,
        'npc_id', cp.npc_id,
        'item_id', cp.item_id,
        'custom_poi_id', pp.custom_poi_id -- Keep reference for migration tracking
    ) as proposed_data,
    'Migrated from pending POI system' as notes,
    pp.vote_score,
    'pending' as status,
    pp.created_at
FROM pending_pois pp
LEFT JOIN custom_pois cp ON pp.custom_poi_id = cp.id
WHERE NOT EXISTS (
    -- Don't migrate if already exists in change_proposals
    SELECT 1 FROM change_proposals cp2 
    WHERE cp2.proposed_data->>'custom_poi_id' = pp.custom_poi_id::text
);

-- Migrate all pending POI votes to change_proposal_votes
INSERT INTO change_proposal_votes (
    proposal_id,
    user_id,
    vote,
    created_at
)
SELECT 
    cp.id as proposal_id,
    ppv.user_id,
    ppv.vote,
    ppv.created_at
FROM pending_poi_votes ppv
JOIN pending_pois pp ON ppv.pending_poi_id = pp.id
JOIN change_proposals cp ON cp.proposed_data->>'custom_poi_id' = pp.custom_poi_id::text
WHERE NOT EXISTS (
    -- Don't migrate if vote already exists
    SELECT 1 FROM change_proposal_votes cpv 
    WHERE cpv.proposal_id = cp.id AND cpv.user_id = ppv.user_id
);

-- Update the vote scores to ensure they match
UPDATE change_proposals cp
SET vote_score = (
    SELECT COUNT(*) FILTER (WHERE vote = 1) - COUNT(*) FILTER (WHERE vote = -1) + 1 -- +1 for proposer's implicit upvote
    FROM change_proposal_votes cpv
    WHERE cpv.proposal_id = cp.id
)
WHERE cp.change_type = 'add_poi' 
  AND cp.proposed_data->>'custom_poi_id' IS NOT NULL;

-- Create a migration tracking table to preserve relationships
CREATE TABLE IF NOT EXISTS pending_poi_migration (
    old_pending_poi_id INTEGER PRIMARY KEY,
    new_proposal_id INTEGER REFERENCES change_proposals(id),
    custom_poi_id INTEGER,
    migrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Track the migration
INSERT INTO pending_poi_migration (old_pending_poi_id, new_proposal_id, custom_poi_id)
SELECT 
    pp.id as old_pending_poi_id,
    cp.id as new_proposal_id,
    pp.custom_poi_id
FROM pending_pois pp
JOIN change_proposals cp ON cp.proposed_data->>'custom_poi_id' = pp.custom_poi_id::text;

-- Note: The actual deletion of old tables should be done after verifying the migration
-- For now, we'll just add a migration status to track completion
ALTER TABLE pending_pois ADD COLUMN IF NOT EXISTS migrated_to_proposals BOOLEAN DEFAULT FALSE;
UPDATE pending_pois SET migrated_to_proposals = TRUE 
WHERE id IN (SELECT old_pending_poi_id FROM pending_poi_migration);

-- Add indexes for the new JSONB queries
CREATE INDEX IF NOT EXISTS idx_change_proposals_poi_custom_id 
ON change_proposals ((proposed_data->>'custom_poi_id')) 
WHERE change_type = 'add_poi';

CREATE INDEX IF NOT EXISTS idx_change_proposals_poi_map_id 
ON change_proposals ((proposed_data->>'map_id')) 
WHERE change_type = 'add_poi';