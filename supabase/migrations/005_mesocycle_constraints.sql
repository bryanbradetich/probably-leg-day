-- =============================================================================
-- Probably Leg Day — Mesocycle: one active per user
-- =============================================================================

-- Enforce only one active mesocycle per user at a time
CREATE UNIQUE INDEX one_active_mesocycle_per_user
ON mesocycles (user_id)
WHERE status = 'active';
