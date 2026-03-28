/**
 * Shared types for Probably Leg Day.
 * Align with Supabase schema: exercises, mesocycles, workout_templates,
 * workout_template_exercises, workout_logs, workout_log_exercises.
 */

export type ExerciseType = "reps_sets" | "timed";

export type EquipmentType =
  | "barbell"
  | "dumbbell"
  | "cable"
  | "machine"
  | "smith_machine"
  | "bodyweight"
  | "resistance_band"
  | "kettlebell";

export type WeightLoggingType =
  | "per_hand"
  | "total"
  | "user_choice"
  | "bodyweight_only"
  | "not_applicable";

export type MesocycleStatus = "active" | "completed" | "planned";

export type RecordType =
  | "max_weight"
  | "max_reps"
  | "max_volume"
  | "max_duration";

export interface Exercise {
  id: string;
  name: string;
  description: string | null;
  type: ExerciseType;
  muscle_groups: string[] | null;
  equipment: EquipmentType | null;
  weight_logging?: WeightLoggingType;
  is_unilateral?: boolean;
  created_by: string | null;
  is_public: boolean;
  created_at: string;
}

export interface Mesocycle {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: MesocycleStatus;
  created_at: string;
  updated_at: string;
}

export interface WorkoutTemplate {
  id: string;
  user_id: string;
  mesocycle_id: string | null;
  name: string;
  description: string | null;
  day_of_week: number | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutTemplateExercise {
  id: string;
  template_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number;
  target_reps: number | null;
  target_duration_seconds: number | null;
  target_rest_seconds: number;
  notes: string | null;
}

export interface WorkoutLog {
  id: string;
  user_id: string;
  mesocycle_id: string | null;
  template_id: string | null;
  name: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
  created_at: string;
  is_draft?: boolean;
}

export interface WorkoutLogExercise {
  id: string;
  workout_log_id: string;
  exercise_id: string;
  order_index: number;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  rpe: number | null;
  is_personal_record: boolean;
  notes: string | null;
  created_at: string;
  weight_logging_choice?: "per_hand" | "total" | null;
}

export interface PersonalRecord {
  id: string;
  user_id: string;
  exercise_id: string;
  record_type: RecordType;
  value: number;
  workout_log_exercise_id: string | null;
  achieved_at: string;
  created_at: string;
}

export interface BodyMeasurement {
  id: string;
  user_id: string;
  measured_at: string;
  weight_kg: number | null;
  body_fat_percentage: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  bicep_cm: number | null;
  thigh_cm: number | null;
  notes: string | null;
  created_at: string;
}

export type WeeklyLossType = "percentage" | "fixed";

export interface DailyWeight {
  id: string;
  user_id: string;
  logged_date: string;
  weight_kg: number;
  notes: string | null;
  created_at: string;
}

export interface WeightGoal {
  id: string;
  user_id: string;
  goal_weight_kg: number;
  target_date: string | null;
  weekly_loss_type: WeeklyLossType;
  weekly_loss_value: number;
  created_at: string;
  updated_at: string;
}
