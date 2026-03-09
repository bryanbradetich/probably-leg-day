-- =============================================================================
-- Probably Leg Day — Initial Database Schema
-- Multi-user workout tracking with mesocycles, exercises, and reporting
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Custom ENUM types
-- -----------------------------------------------------------------------------

CREATE TYPE exercise_type AS ENUM ('reps_sets', 'timed');

CREATE TYPE mesocycle_status AS ENUM ('active', 'completed', 'planned');

CREATE TYPE record_type AS ENUM ('max_weight', 'max_reps', 'max_volume', 'max_duration');

-- -----------------------------------------------------------------------------
-- 1. profiles — extends Supabase Auth users
-- -----------------------------------------------------------------------------

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE profiles IS 'User profiles linked to Supabase Auth; one row per user.';

-- -----------------------------------------------------------------------------
-- 2. exercises — global exercise library (default + user-created)
-- -----------------------------------------------------------------------------

CREATE TABLE exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type exercise_type NOT NULL,
  muscle_groups text[] DEFAULT '{}',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE exercises IS 'Global exercise library; created_by IS NULL for app defaults, else user-owned.';
COMMENT ON COLUMN exercises.muscle_groups IS 'e.g. {chest, triceps}';
COMMENT ON COLUMN exercises.is_public IS 'When true, visible to all users; when false, only created_by.';

-- -----------------------------------------------------------------------------
-- 3. mesocycles — workout programs (e.g. 4–6 week blocks)
-- -----------------------------------------------------------------------------

CREATE TABLE mesocycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  start_date date,
  end_date date,
  status mesocycle_status NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE mesocycles IS 'User workout programs (mesocycles); can be active, completed, or planned.';

-- -----------------------------------------------------------------------------
-- 4. workout_templates — reusable workout plans (optionally tied to a mesocycle)
-- -----------------------------------------------------------------------------

CREATE TABLE workout_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mesocycle_id uuid REFERENCES mesocycles(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  day_of_week integer CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE workout_templates IS 'Reusable workout plans; day_of_week 0–6 (Sun–Sat) when scheduled.';

-- -----------------------------------------------------------------------------
-- 5. workout_template_exercises — exercises and targets within a template
-- -----------------------------------------------------------------------------

CREATE TABLE workout_template_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  order_index integer NOT NULL,
  target_sets integer NOT NULL,
  target_reps integer,
  target_duration_seconds integer,
  target_rest_seconds integer DEFAULT 0,
  notes text
);

COMMENT ON TABLE workout_template_exercises IS 'Exercises in a template; target_reps for reps_sets, target_duration_seconds for timed.';

-- -----------------------------------------------------------------------------
-- 6. workout_logs — completed workout sessions
-- -----------------------------------------------------------------------------

CREATE TABLE workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mesocycle_id uuid REFERENCES mesocycles(id) ON DELETE SET NULL,
  template_id uuid REFERENCES workout_templates(id) ON DELETE SET NULL,
  name text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  duration_seconds integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE workout_logs IS 'Actual completed workouts; can optionally link to a mesocycle and/or template.';

-- -----------------------------------------------------------------------------
-- 7. workout_log_exercises — individual sets within a logged workout
-- -----------------------------------------------------------------------------

CREATE TABLE workout_log_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_log_id uuid NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  order_index integer NOT NULL,
  set_number integer NOT NULL,
  reps integer,
  weight_kg numeric,
  duration_seconds integer,
  rpe numeric CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  is_personal_record boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE workout_log_exercises IS 'Per-set data for a logged workout; reps/weight for strength, duration for timed.';
COMMENT ON COLUMN workout_log_exercises.rpe IS 'Rate of perceived exertion 1–10.';

-- -----------------------------------------------------------------------------
-- 8. personal_records — PRs for max weight, reps, volume, or duration
-- -----------------------------------------------------------------------------

CREATE TABLE personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  record_type record_type NOT NULL,
  value numeric NOT NULL,
  workout_log_exercise_id uuid REFERENCES workout_log_exercises(id) ON DELETE SET NULL,
  achieved_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE personal_records IS 'Personal records; links to the set that achieved the PR when available.';

-- -----------------------------------------------------------------------------
-- 9. body_measurements — weight, body fat, circumferences
-- -----------------------------------------------------------------------------

CREATE TABLE body_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  measured_at timestamptz NOT NULL,
  weight_kg numeric,
  body_fat_percentage numeric,
  chest_cm numeric,
  waist_cm numeric,
  hips_cm numeric,
  bicep_cm numeric,
  thigh_cm numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE body_measurements IS 'User body metrics over time for reporting.';

-- -----------------------------------------------------------------------------
-- Indexes — foreign keys and common query fields
-- -----------------------------------------------------------------------------

-- profiles: rarely queried by FKs; username lookups
CREATE INDEX idx_profiles_username ON profiles(username);

-- exercises
CREATE INDEX idx_exercises_created_by ON exercises(created_by);
CREATE INDEX idx_exercises_type ON exercises(type);
CREATE INDEX idx_exercises_is_public ON exercises(is_public);

-- mesocycles
CREATE INDEX idx_mesocycles_user_id ON mesocycles(user_id);
CREATE INDEX idx_mesocycles_status ON mesocycles(status);
CREATE INDEX idx_mesocycles_start_date ON mesocycles(start_date);
CREATE INDEX idx_mesocycles_end_date ON mesocycles(end_date);

-- workout_templates
CREATE INDEX idx_workout_templates_user_id ON workout_templates(user_id);
CREATE INDEX idx_workout_templates_mesocycle_id ON workout_templates(mesocycle_id);

-- workout_template_exercises
CREATE INDEX idx_workout_template_exercises_template_id ON workout_template_exercises(template_id);
CREATE INDEX idx_workout_template_exercises_exercise_id ON workout_template_exercises(exercise_id);

-- workout_logs
CREATE INDEX idx_workout_logs_user_id ON workout_logs(user_id);
CREATE INDEX idx_workout_logs_mesocycle_id ON workout_logs(mesocycle_id);
CREATE INDEX idx_workout_logs_template_id ON workout_logs(template_id);
CREATE INDEX idx_workout_logs_started_at ON workout_logs(started_at);
CREATE INDEX idx_workout_logs_completed_at ON workout_logs(completed_at);

-- workout_log_exercises
CREATE INDEX idx_workout_log_exercises_workout_log_id ON workout_log_exercises(workout_log_id);
CREATE INDEX idx_workout_log_exercises_exercise_id ON workout_log_exercises(exercise_id);

-- personal_records
CREATE INDEX idx_personal_records_user_id ON personal_records(user_id);
CREATE INDEX idx_personal_records_exercise_id ON personal_records(exercise_id);
CREATE INDEX idx_personal_records_achieved_at ON personal_records(achieved_at);
CREATE INDEX idx_personal_records_workout_log_exercise_id ON personal_records(workout_log_exercise_id);

-- body_measurements
CREATE INDEX idx_body_measurements_user_id ON body_measurements(user_id);
CREATE INDEX idx_body_measurements_measured_at ON body_measurements(measured_at);

-- -----------------------------------------------------------------------------
-- Row Level Security (RLS) — enable on all tables
-- -----------------------------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesocycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_log_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- RLS Policies — users can only read/write their own data
-- -----------------------------------------------------------------------------

-- profiles: users can read/update only their own row
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- exercises: read all public exercises + own; insert/update/delete only own
CREATE POLICY "Anyone can view public exercises"
  ON exercises FOR SELECT
  USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "Users can create own exercises"
  ON exercises FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own exercises"
  ON exercises FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete own exercises"
  ON exercises FOR DELETE
  USING (created_by = auth.uid());

-- mesocycles: full CRUD on own rows
CREATE POLICY "Users can view own mesocycles"
  ON mesocycles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own mesocycles"
  ON mesocycles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own mesocycles"
  ON mesocycles FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own mesocycles"
  ON mesocycles FOR DELETE
  USING (user_id = auth.uid());

-- workout_templates: full CRUD on own rows
CREATE POLICY "Users can view own workout_templates"
  ON workout_templates FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own workout_templates"
  ON workout_templates FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own workout_templates"
  ON workout_templates FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own workout_templates"
  ON workout_templates FOR DELETE
  USING (user_id = auth.uid());

-- workout_template_exercises: access via template ownership
CREATE POLICY "Users can view workout_template_exercises for own templates"
  ON workout_template_exercises FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates t
      WHERE t.id = template_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert workout_template_exercises for own templates"
  ON workout_template_exercises FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_templates t
      WHERE t.id = template_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update workout_template_exercises for own templates"
  ON workout_template_exercises FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates t
      WHERE t.id = template_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete workout_template_exercises for own templates"
  ON workout_template_exercises FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates t
      WHERE t.id = template_id AND t.user_id = auth.uid()
    )
  );

-- workout_logs: full CRUD on own rows
CREATE POLICY "Users can view own workout_logs"
  ON workout_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own workout_logs"
  ON workout_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own workout_logs"
  ON workout_logs FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own workout_logs"
  ON workout_logs FOR DELETE
  USING (user_id = auth.uid());

-- workout_log_exercises: access via workout_log ownership
CREATE POLICY "Users can view workout_log_exercises for own logs"
  ON workout_log_exercises FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workout_logs w
      WHERE w.id = workout_log_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert workout_log_exercises for own logs"
  ON workout_log_exercises FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_logs w
      WHERE w.id = workout_log_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update workout_log_exercises for own logs"
  ON workout_log_exercises FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workout_logs w
      WHERE w.id = workout_log_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete workout_log_exercises for own logs"
  ON workout_log_exercises FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workout_logs w
      WHERE w.id = workout_log_id AND w.user_id = auth.uid()
    )
  );

-- personal_records: full CRUD on own rows
CREATE POLICY "Users can view own personal_records"
  ON personal_records FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own personal_records"
  ON personal_records FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own personal_records"
  ON personal_records FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own personal_records"
  ON personal_records FOR DELETE
  USING (user_id = auth.uid());

-- body_measurements: full CRUD on own rows
CREATE POLICY "Users can view own body_measurements"
  ON body_measurements FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own body_measurements"
  ON body_measurements FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own body_measurements"
  ON body_measurements FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own body_measurements"
  ON body_measurements FOR DELETE
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Trigger: create profile on new auth user
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Trigger: keep profiles.updated_at in sync
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_mesocycles_updated_at
  BEFORE UPDATE ON mesocycles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_workout_templates_updated_at
  BEFORE UPDATE ON workout_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Function: Epley one-rep max estimate
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.calculate_one_rep_max(weight numeric, reps integer)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN weight IS NULL OR reps IS NULL OR reps < 1 THEN NULL
    WHEN reps = 1 THEN weight
    ELSE weight * (1 + reps::numeric / 30.0)
  END;
$$;

COMMENT ON FUNCTION public.calculate_one_rep_max(numeric, integer) IS 'Epley formula: weight * (1 + reps/30). Returns NULL for invalid inputs.';

-- -----------------------------------------------------------------------------
-- Seed: 20 common exercises (mix of reps_sets and timed)
-- -----------------------------------------------------------------------------

INSERT INTO exercises (id, name, description, type, muscle_groups, created_by, is_public) VALUES
  (gen_random_uuid(), 'Barbell Bench Press', 'Flat bench barbell press for chest', 'reps_sets', ARRAY['chest', 'triceps', 'shoulders'], NULL, true),
  (gen_random_uuid(), 'Barbell Back Squat', 'Back squat with barbell', 'reps_sets', ARRAY['quadriceps', 'glutes', 'hamstrings', 'core'], NULL, true),
  (gen_random_uuid(), 'Deadlift', 'Conventional barbell deadlift', 'reps_sets', ARRAY['back', 'hamstrings', 'glutes', 'core'], NULL, true),
  (gen_random_uuid(), 'Overhead Press', 'Standing barbell or dumbbell shoulder press', 'reps_sets', ARRAY['shoulders', 'triceps', 'core'], NULL, true),
  (gen_random_uuid(), 'Barbell Row', 'Bent-over barbell row', 'reps_sets', ARRAY['back', 'biceps', 'rear delts'], NULL, true),
  (gen_random_uuid(), 'Pull-up', 'Bodyweight or weighted pull-up', 'reps_sets', ARRAY['back', 'biceps', 'core'], NULL, true),
  (gen_random_uuid(), 'Dumbbell Bicep Curl', 'Standing or seated dumbbell curl', 'reps_sets', ARRAY['biceps'], NULL, true),
  (gen_random_uuid(), 'Tricep Pushdown', 'Cable or band tricep pushdown', 'reps_sets', ARRAY['triceps'], NULL, true),
  (gen_random_uuid(), 'Leg Press', 'Machine leg press', 'reps_sets', ARRAY['quadriceps', 'glutes', 'hamstrings'], NULL, true),
  (gen_random_uuid(), 'Romanian Deadlift', 'RDL for hamstrings and glutes', 'reps_sets', ARRAY['hamstrings', 'glutes', 'back'], NULL, true),
  (gen_random_uuid(), 'Lunges', 'Walking or stationary lunges', 'reps_sets', ARRAY['quadriceps', 'glutes', 'hamstrings'], NULL, true),
  (gen_random_uuid(), 'Calf Raise', 'Standing or seated calf raise', 'reps_sets', ARRAY['calves'], NULL, true),
  (gen_random_uuid(), 'Plank', 'Front plank hold', 'timed', ARRAY['core', 'shoulders'], NULL, true),
  (gen_random_uuid(), 'Wall Sit', 'Back against wall, knees bent 90°', 'timed', ARRAY['quadriceps'], NULL, true),
  (gen_random_uuid(), 'Hanging Leg Raise', 'Hanging knee or leg raise', 'reps_sets', ARRAY['core', 'hip flexors'], NULL, true),
  (gen_random_uuid(), 'Push-up', 'Bodyweight push-up', 'reps_sets', ARRAY['chest', 'triceps', 'shoulders', 'core'], NULL, true),
  (gen_random_uuid(), 'Dips', 'Bench or parallel bar dips', 'reps_sets', ARRAY['chest', 'triceps', 'shoulders'], NULL, true),
  (gen_random_uuid(), 'Farmer''s Walk', 'Carry heavy weights for distance or time', 'timed', ARRAY['traps', 'forearms', 'core', 'legs'], NULL, true),
  (gen_random_uuid(), 'Running (Treadmill)', 'Running on treadmill', 'timed', ARRAY['legs', 'cardiovascular'], NULL, true),
  (gen_random_uuid(), 'Rowing Machine', 'Indoor rower', 'timed', ARRAY['back', 'legs', 'cardiovascular'], NULL, true);
