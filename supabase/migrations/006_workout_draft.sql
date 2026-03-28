-- Draft workouts: in-progress logs auto-saved from the workout logger

ALTER TABLE workout_logs
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN workout_logs.is_draft IS 'When true, workout is an in-progress draft from /workouts/log; exclude from history and reporting.';

CREATE INDEX IF NOT EXISTS idx_workout_logs_user_id_is_draft
  ON workout_logs(user_id, is_draft);

-- -----------------------------------------------------------------------------
-- Reminder: apply this migration to your Supabase project before using draft
-- auto-save (e.g. `supabase db push` or run the SQL in the Supabase SQL editor).
-- -----------------------------------------------------------------------------
