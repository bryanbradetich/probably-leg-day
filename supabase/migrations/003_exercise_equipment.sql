-- =============================================================================
-- Probably Leg Day — Exercise equipment & weight logging
-- Adds equipment_type, weight_logging_type, and new columns to exercises.
-- Re-seeds the exercise library (Planet Fitness–style).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- New ENUM types
-- -----------------------------------------------------------------------------

CREATE TYPE equipment_type AS ENUM (
  'barbell', 'dumbbell', 'cable', 'machine',
  'smith_machine', 'bodyweight', 'resistance_band', 'kettlebell'
);

CREATE TYPE weight_logging_type AS ENUM (
  'per_hand', 'total', 'user_choice', 'bodyweight_only', 'not_applicable'
);

-- -----------------------------------------------------------------------------
-- Add columns to exercises
-- -----------------------------------------------------------------------------

ALTER TABLE exercises
  ADD COLUMN equipment equipment_type,
  ADD COLUMN weight_logging weight_logging_type NOT NULL DEFAULT 'total',
  ADD COLUMN is_unilateral boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN exercises.equipment IS 'Primary equipment used; nullable for legacy or mixed.';
COMMENT ON COLUMN exercises.weight_logging IS 'How weight is logged: per hand, total, user choice, bodyweight only, or N/A.';
COMMENT ON COLUMN exercises.is_unilateral IS 'True for single-arm or single-leg exercises.';

-- -----------------------------------------------------------------------------
-- Remove seed exercises (created_by IS NULL) and re-seed
-- -----------------------------------------------------------------------------

DELETE FROM exercises WHERE created_by IS NULL;

-- -----------------------------------------------------------------------------
-- Seed: comprehensive library (Planet Fitness–style, 40+ exercises)
-- -----------------------------------------------------------------------------

INSERT INTO exercises (name, description, type, muscle_groups, equipment, weight_logging, is_unilateral, created_by, is_public) VALUES
-- Barbell
('Barbell Bench Press', 'Flat bench barbell press for chest development', 'reps_sets', ARRAY['chest', 'triceps', 'shoulders'], 'barbell', 'total', false, NULL, true),
('Barbell Back Squat', 'Back squat with barbell on upper back', 'reps_sets', ARRAY['quadriceps', 'glutes', 'hamstrings', 'core'], 'barbell', 'total', false, NULL, true),
('Deadlift', 'Conventional barbell deadlift from floor', 'reps_sets', ARRAY['back', 'hamstrings', 'glutes', 'core'], 'barbell', 'total', false, NULL, true),
('Barbell Overhead Press', 'Standing barbell shoulder press', 'reps_sets', ARRAY['shoulders', 'triceps', 'core'], 'barbell', 'total', false, NULL, true),
('Barbell Row', 'Bent-over barbell row for back thickness', 'reps_sets', ARRAY['back', 'biceps', 'rear delts'], 'barbell', 'total', false, NULL, true),
('Barbell Romanian Deadlift', 'RDL for hamstrings and glutes', 'reps_sets', ARRAY['hamstrings', 'glutes', 'back'], 'barbell', 'total', false, NULL, true),
('Barbell Curl', 'Standing barbell bicep curl', 'reps_sets', ARRAY['biceps'], 'barbell', 'total', false, NULL, true),
-- Dumbbell
('Dumbbell Bench Press', 'Flat bench dumbbell press', 'reps_sets', ARRAY['chest', 'triceps', 'shoulders'], 'dumbbell', 'total', false, NULL, true),
('Dumbbell Shoulder Press', 'Seated or standing dumbbell overhead press', 'reps_sets', ARRAY['shoulders', 'triceps'], 'dumbbell', 'total', false, NULL, true),
('Dumbbell Row', 'Single-arm bent-over dumbbell row', 'reps_sets', ARRAY['back', 'biceps', 'rear delts'], 'dumbbell', 'per_hand', true, NULL, true),
('Dumbbell Curl', 'Dumbbell bicep curl (alternating or one arm)', 'reps_sets', ARRAY['biceps'], 'dumbbell', 'per_hand', true, NULL, true),
('Dumbbell Lateral Raise', 'Side lateral raise for shoulders', 'reps_sets', ARRAY['shoulders'], 'dumbbell', 'per_hand', true, NULL, true),
('Dumbbell Fly', 'Chest fly with dumbbells on bench', 'reps_sets', ARRAY['chest'], 'dumbbell', 'per_hand', true, NULL, true),
('Dumbbell Romanian Deadlift', 'RDL with dumbbells', 'reps_sets', ARRAY['hamstrings', 'glutes', 'back'], 'dumbbell', 'total', false, NULL, true),
('Goblet Squat', 'Front-loaded squat holding one dumbbell', 'reps_sets', ARRAY['quadriceps', 'glutes', 'core'], 'dumbbell', 'total', false, NULL, true),
-- Cable
('Cable Fly', 'Cable chest fly (high, mid, or low)', 'reps_sets', ARRAY['chest'], 'cable', 'total', false, NULL, true),
('Cable Row', 'Seated cable row', 'reps_sets', ARRAY['back', 'biceps', 'rear delts'], 'cable', 'total', false, NULL, true),
('Lat Pulldown', 'Cable or machine lat pulldown', 'reps_sets', ARRAY['back', 'biceps'], 'cable', 'total', false, NULL, true),
('Cable Tricep Pushdown', 'Tricep pushdown with rope or bar', 'reps_sets', ARRAY['triceps'], 'cable', 'total', false, NULL, true),
('Cable Bicep Curl', 'Cable bicep curl', 'reps_sets', ARRAY['biceps'], 'cable', 'total', false, NULL, true),
('Cable Lateral Raise', 'Single-arm or dual cable lateral raise', 'reps_sets', ARRAY['shoulders'], 'cable', 'per_hand', true, NULL, true),
('Face Pull', 'Cable face pull for rear delts and upper back', 'reps_sets', ARRAY['rear delts', 'back', 'biceps'], 'cable', 'total', false, NULL, true),
-- Machine
('Leg Press', 'Machine leg press', 'reps_sets', ARRAY['quadriceps', 'glutes', 'hamstrings'], 'machine', 'total', false, NULL, true),
('Leg Extension', 'Machine leg extension for quads', 'reps_sets', ARRAY['quadriceps'], 'machine', 'total', false, NULL, true),
('Leg Curl', 'Machine leg curl (seated or lying)', 'reps_sets', ARRAY['hamstrings'], 'machine', 'total', false, NULL, true),
('Chest Press Machine', 'Machine chest press', 'reps_sets', ARRAY['chest', 'triceps', 'shoulders'], 'machine', 'total', false, NULL, true),
('Shoulder Press Machine', 'Machine overhead shoulder press', 'reps_sets', ARRAY['shoulders', 'triceps'], 'machine', 'total', false, NULL, true),
('Seated Row Machine', 'Machine seated row', 'reps_sets', ARRAY['back', 'biceps', 'rear delts'], 'machine', 'total', false, NULL, true),
('Pec Deck', 'Cable or machine pec deck / chest fly', 'reps_sets', ARRAY['chest'], 'machine', 'total', false, NULL, true),
('Hip Abductor', 'Machine hip abductor', 'reps_sets', ARRAY['glutes', 'hips'], 'machine', 'total', false, NULL, true),
('Hip Adductor', 'Machine hip adductor', 'reps_sets', ARRAY['inner thighs', 'hips'], 'machine', 'total', false, NULL, true),
('Calf Raise Machine', 'Seated or standing calf raise machine', 'reps_sets', ARRAY['calves'], 'machine', 'total', false, NULL, true),
-- Smith Machine
('Smith Machine Squat', 'Squat in smith machine', 'reps_sets', ARRAY['quadriceps', 'glutes', 'hamstrings', 'core'], 'smith_machine', 'total', false, NULL, true),
('Smith Machine Bench Press', 'Bench press in smith machine', 'reps_sets', ARRAY['chest', 'triceps', 'shoulders'], 'smith_machine', 'total', false, NULL, true),
('Smith Machine Overhead Press', 'Overhead press in smith machine', 'reps_sets', ARRAY['shoulders', 'triceps', 'core'], 'smith_machine', 'total', false, NULL, true),
-- Bodyweight
('Pull-up', 'Bodyweight or weighted pull-up', 'reps_sets', ARRAY['back', 'biceps', 'core'], 'bodyweight', 'bodyweight_only', false, NULL, true),
('Push-up', 'Bodyweight push-up', 'reps_sets', ARRAY['chest', 'triceps', 'shoulders', 'core'], 'bodyweight', 'bodyweight_only', false, NULL, true),
('Dip', 'Bench or parallel bar dips', 'reps_sets', ARRAY['chest', 'triceps', 'shoulders'], 'bodyweight', 'bodyweight_only', false, NULL, true),
('Plank', 'Front plank hold', 'timed', ARRAY['core', 'shoulders'], 'bodyweight', 'not_applicable', false, NULL, true),
('Wall Sit', 'Back against wall, knees bent 90°', 'timed', ARRAY['quadriceps'], 'bodyweight', 'not_applicable', false, NULL, true),
('Hanging Leg Raise', 'Hanging knee or leg raise for core', 'reps_sets', ARRAY['core', 'hip flexors'], 'bodyweight', 'bodyweight_only', false, NULL, true),
('Glute Bridge', 'Hip thrust from floor', 'reps_sets', ARRAY['glutes', 'hamstrings', 'core'], 'bodyweight', 'bodyweight_only', false, NULL, true),
-- Resistance Band
('Band Pull Apart', 'Resistance band pull apart for upper back', 'reps_sets', ARRAY['rear delts', 'back'], 'resistance_band', 'not_applicable', false, NULL, true),
('Band Face Pull', 'Face pull with resistance band', 'reps_sets', ARRAY['rear delts', 'back', 'biceps'], 'resistance_band', 'not_applicable', false, NULL, true),
('Band Bicep Curl', 'Bicep curl with resistance band', 'reps_sets', ARRAY['biceps'], 'resistance_band', 'total', false, NULL, true),
-- Kettlebell
('Kettlebell Swing', 'Two-hand kettlebell swing', 'reps_sets', ARRAY['hamstrings', 'glutes', 'core', 'shoulders'], 'kettlebell', 'total', false, NULL, true),
('Kettlebell Goblet Squat', 'Goblet squat with kettlebell', 'reps_sets', ARRAY['quadriceps', 'glutes', 'core'], 'kettlebell', 'total', false, NULL, true),
('Turkish Get-Up', 'Full turkish get-up', 'reps_sets', ARRAY['shoulders', 'core', 'full body'], 'kettlebell', 'per_hand', true, NULL, true);
