-- Store user's choice for weight display (per hand vs total) when exercise has weight_logging = 'user_choice'
ALTER TABLE workout_log_exercises
  ADD COLUMN IF NOT EXISTS weight_logging_choice text
  CHECK (weight_logging_choice IS NULL OR weight_logging_choice IN ('per_hand', 'total'));

COMMENT ON COLUMN workout_log_exercises.weight_logging_choice IS 'For exercises with weight_logging=user_choice: whether user logged per hand or total.';
