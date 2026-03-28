-- BMR/TDEE profile fields and per-activity calorie burns

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS height_cm numeric,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS biological_sex text CHECK (biological_sex IS NULL OR biological_sex IN ('male', 'female')),
  ADD COLUMN IF NOT EXISTS activity_level text NOT NULL DEFAULT 'sedentary'
    CHECK (activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'custom')),
  ADD COLUMN IF NOT EXISTS custom_activity_multiplier numeric;

COMMENT ON COLUMN profiles.height_cm IS 'Height in centimeters (for Mifflin-St Jeor BMR).';
COMMENT ON COLUMN profiles.date_of_birth IS 'For age in BMR calculation.';
COMMENT ON COLUMN profiles.biological_sex IS 'male or female for BMR formula only.';
COMMENT ON COLUMN profiles.activity_level IS 'NEAT multiplier tier or custom.';
COMMENT ON COLUMN profiles.custom_activity_multiplier IS 'Used when activity_level = custom.';

CREATE TABLE calorie_burns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  logged_date date NOT NULL,
  activity_name text NOT NULL,
  calories_burned numeric NOT NULL,
  duration_minutes integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE calorie_burns IS 'User-logged exercise or activity calorie burns by day.';

CREATE INDEX idx_calorie_burns_user_logged_date ON calorie_burns(user_id, logged_date);

ALTER TABLE calorie_burns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calorie_burns_select_own"
  ON calorie_burns FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "calorie_burns_insert_own"
  ON calorie_burns FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "calorie_burns_update_own"
  ON calorie_burns FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "calorie_burns_delete_own"
  ON calorie_burns FOR DELETE
  USING (user_id = auth.uid());
