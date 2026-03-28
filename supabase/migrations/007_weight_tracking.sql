-- Daily morning weights and per-user weight goals (one goal row per user)

CREATE TABLE daily_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  logged_date date NOT NULL,
  weight_kg numeric NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, logged_date)
);

COMMENT ON TABLE daily_weights IS 'One weigh-in per calendar day per user; weight_kg is canonical.';

CREATE INDEX idx_daily_weights_user_logged ON daily_weights(user_id, logged_date DESC);

ALTER TABLE daily_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily_weights"
  ON daily_weights FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own daily_weights"
  ON daily_weights FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own daily_weights"
  ON daily_weights FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own daily_weights"
  ON daily_weights FOR DELETE
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------

CREATE TABLE weight_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  goal_weight_kg numeric NOT NULL,
  target_date date,
  weekly_loss_type text NOT NULL DEFAULT 'percentage' CHECK (weekly_loss_type IN ('percentage', 'fixed')),
  weekly_loss_value numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weight_goals_one_per_user UNIQUE (user_id)
);

COMMENT ON TABLE weight_goals IS 'Single active weight goal per user; weekly_loss_value is percent (e.g. 0.5) or kg/week when weekly_loss_type is fixed.';

ALTER TABLE weight_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weight_goals"
  ON weight_goals FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own weight_goals"
  ON weight_goals FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own weight_goals"
  ON weight_goals FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own weight_goals"
  ON weight_goals FOR DELETE
  USING (user_id = auth.uid());

CREATE TRIGGER set_weight_goals_updated_at
  BEFORE UPDATE ON weight_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Reminder: apply this migration in the Supabase SQL Editor (or supabase db push).
-- -----------------------------------------------------------------------------
