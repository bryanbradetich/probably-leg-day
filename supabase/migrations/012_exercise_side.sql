-- Add per-side tracking for unilateral dumbbell/cable sets

ALTER TABLE workout_log_exercises
  ADD COLUMN IF NOT EXISTS side text
  CHECK (side IN ('left', 'right', 'both'))
  DEFAULT 'both';

UPDATE workout_log_exercises
SET side = 'both'
WHERE side IS NULL;

