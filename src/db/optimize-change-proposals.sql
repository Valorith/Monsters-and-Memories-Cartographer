-- Additional indexes for performance optimization of the change proposals system

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_change_proposals_pending_type 
ON change_proposals(status, change_type) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_change_proposals_user_pending 
ON change_proposals(proposer_id, status) 
WHERE status = 'pending';

-- JSONB GIN indexes for flexible querying
CREATE INDEX IF NOT EXISTS idx_change_proposals_current_gin 
ON change_proposals USING gin (current_data);

CREATE INDEX IF NOT EXISTS idx_change_proposals_proposed_gin 
ON change_proposals USING gin (proposed_data);

-- Specific JSONB path indexes for common queries
CREATE INDEX IF NOT EXISTS idx_change_proposals_map_id 
ON change_proposals ((proposed_data->>'map_id')) 
WHERE change_type IN ('add_poi', 'edit_poi', 'move_poi');

-- Partial indexes for vote counting performance
CREATE INDEX IF NOT EXISTS idx_proposal_votes_upvotes 
ON change_proposal_votes(proposal_id) 
WHERE vote = 1;

CREATE INDEX IF NOT EXISTS idx_proposal_votes_downvotes 
ON change_proposal_votes(proposal_id) 
WHERE vote = -1;

-- Function to efficiently calculate vote score
CREATE OR REPLACE FUNCTION get_proposal_vote_score(proposal_id_param INTEGER)
RETURNS TABLE(
  vote_score INTEGER,
  upvotes INTEGER,
  downvotes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(vote), 0)::INTEGER as vote_score,
    COUNT(*) FILTER (WHERE vote = 1)::INTEGER as upvotes,
    COUNT(*) FILTER (WHERE vote = -1)::INTEGER as downvotes
  FROM change_proposal_votes
  WHERE proposal_id = proposal_id_param;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if a user has voted on a proposal
CREATE OR REPLACE FUNCTION user_vote_on_proposal(user_id_param INTEGER, proposal_id_param INTEGER)
RETURNS INTEGER AS $$
DECLARE
  user_vote INTEGER;
BEGIN
  SELECT vote INTO user_vote
  FROM change_proposal_votes
  WHERE user_id = user_id_param AND proposal_id = proposal_id_param;
  
  RETURN COALESCE(user_vote, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- View for efficiently querying pending proposals with vote information
CREATE OR REPLACE VIEW pending_proposals_with_votes AS
SELECT 
  cp.id,
  cp.change_type,
  cp.target_type,
  cp.target_id,
  cp.proposer_id,
  cp.current_data,
  cp.proposed_data,
  cp.notes,
  cp.status,
  cp.admin_id,
  cp.admin_action,
  cp.admin_notes,
  cp.created_at,
  cp.resolved_at,
  COALESCE(u.nickname, u.name) as proposer_name,
  COALESCE(a.nickname, a.name) as admin_name,
  vs.vote_score as calculated_vote_score,
  vs.upvotes,
  vs.downvotes
FROM change_proposals cp
LEFT JOIN users u ON cp.proposer_id = u.id
LEFT JOIN users a ON cp.admin_id = a.id
LEFT JOIN LATERAL get_proposal_vote_score(cp.id) vs ON true
WHERE cp.status = 'pending';

-- Add constraint to ensure vote score stays in sync
CREATE OR REPLACE FUNCTION update_proposal_vote_score()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE change_proposals
  SET vote_score = (
    SELECT COALESCE(SUM(vote), 0) + 1 -- +1 for proposer's implicit upvote
    FROM change_proposal_votes
    WHERE proposal_id = COALESCE(NEW.proposal_id, OLD.proposal_id)
  )
  WHERE id = COALESCE(NEW.proposal_id, OLD.proposal_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_vote_score_on_vote ON change_proposal_votes;
CREATE TRIGGER update_vote_score_on_vote
AFTER INSERT OR UPDATE OR DELETE ON change_proposal_votes
FOR EACH ROW EXECUTE FUNCTION update_proposal_vote_score();

-- Add table for tracking proposal history (for audit and analytics)
CREATE TABLE IF NOT EXISTS change_proposal_history (
  id SERIAL PRIMARY KEY,
  proposal_id INTEGER REFERENCES change_proposals(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'created', 'voted', 'status_changed', 'edited'
  actor_id INTEGER REFERENCES users(id),
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_proposal_history_proposal ON change_proposal_history(proposal_id);
CREATE INDEX idx_proposal_history_actor ON change_proposal_history(actor_id);
CREATE INDEX idx_proposal_history_created ON change_proposal_history(created_at DESC);

-- Function to log proposal changes
CREATE OR REPLACE FUNCTION log_proposal_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO change_proposal_history (proposal_id, action, actor_id, new_data)
    VALUES (NEW.id, 'created', NEW.proposer_id, row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO change_proposal_history (proposal_id, action, actor_id, old_data, new_data)
    VALUES (NEW.id, 'status_changed', NEW.admin_id, 
            jsonb_build_object('status', OLD.status), 
            jsonb_build_object('status', NEW.status));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_proposal_changes ON change_proposals;
CREATE TRIGGER log_proposal_changes
AFTER INSERT OR UPDATE ON change_proposals
FOR EACH ROW EXECUTE FUNCTION log_proposal_change();

-- Add table for proposal templates (for consistent data structure)
CREATE TABLE IF NOT EXISTS change_proposal_templates (
  id SERIAL PRIMARY KEY,
  change_type VARCHAR(50) NOT NULL UNIQUE,
  required_fields JSONB NOT NULL,
  optional_fields JSONB,
  validation_rules JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default templates
INSERT INTO change_proposal_templates (change_type, required_fields, optional_fields, validation_rules)
VALUES 
  ('add_poi', 
   '["map_id", "name", "x", "y"]'::jsonb,
   '["description", "type_id", "icon", "icon_size", "label_visible", "label_position", "npc_id", "item_id"]'::jsonb,
   '{"name": {"minLength": 1, "maxLength": 255}, "x": {"type": "integer"}, "y": {"type": "integer"}}'::jsonb),
  ('edit_poi',
   '["poi_id"]'::jsonb,
   '["name", "description", "x", "y", "type_id", "icon", "npc_id", "item_id"]'::jsonb,
   NULL),
  ('add_npc',
   '["name", "level", "hp", "ac", "min_dmg", "max_dmg"]'::jsonb,
   '["description", "respawn_time", "loot", "spawn_chance"]'::jsonb,
   '{"level": {"min": 1, "max": 100}, "hp": {"min": 1}}'::jsonb),
  ('edit_npc',
   '["npc_id"]'::jsonb,
   '["name", "level", "hp", "ac", "min_dmg", "max_dmg", "description", "respawn_time", "loot"]'::jsonb,
   NULL),
  ('add_item',
   '["name", "type", "icon_type", "icon_value"]'::jsonb,
   '["description", "stats", "ac", "weight", "value", "level_req", "class_req", "race_req", "slot"]'::jsonb,
   '{"type": {"enum": ["weapon", "armor", "consumable", "quest", "misc", "container", "jewelry", "ammo"]}}'::jsonb),
  ('edit_item',
   '["item_id"]'::jsonb,
   '["name", "type", "description", "stats", "icon_type", "icon_value"]'::jsonb,
   NULL)
ON CONFLICT (change_type) DO NOTHING;

-- Performance monitoring view
CREATE OR REPLACE VIEW proposal_statistics AS
SELECT 
  change_type,
  COUNT(*) as total_proposals,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
  COUNT(*) FILTER (WHERE status = 'withdrawn') as withdrawn_count,
  AVG(CASE WHEN status != 'pending' THEN 
    EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 
  END)::numeric(10,2) as avg_resolution_hours
FROM change_proposals
GROUP BY change_type;