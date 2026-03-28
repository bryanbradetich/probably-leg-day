-- Food library, meal templates, daily logs, and nutrition goals

-- -----------------------------------------------------------------------------
-- 1. foods — user-owned + public library (user_id NULL for global public items)
-- -----------------------------------------------------------------------------

CREATE TABLE foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  brand text,
  serving_size numeric NOT NULL,
  serving_unit text NOT NULL CHECK (serving_unit IN ('g', 'oz')),
  calories numeric NOT NULL,
  protein_g numeric NOT NULL DEFAULT 0,
  carbs_g numeric NOT NULL DEFAULT 0,
  fat_g numeric NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE foods IS 'Food items; user_id NULL + is_public for app-wide library rows.';
COMMENT ON COLUMN foods.user_id IS 'Owner; NULL only for seeded/public library foods.';

CREATE INDEX idx_foods_user_id ON foods(user_id);
CREATE INDEX idx_foods_name ON foods(name);
CREATE INDEX idx_foods_is_public ON foods(is_public);

ALTER TABLE foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "foods_select_visible"
  ON foods FOR SELECT
  USING (is_public = true OR user_id = auth.uid());

CREATE POLICY "foods_insert_own"
  ON foods FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "foods_update_own"
  ON foods FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "foods_delete_own"
  ON foods FOR DELETE
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 2. meal_templates — saved meal combos
-- -----------------------------------------------------------------------------

CREATE TABLE meal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meal_templates_user_id ON meal_templates(user_id);

ALTER TABLE meal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_templates_select_own"
  ON meal_templates FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "meal_templates_insert_own"
  ON meal_templates FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "meal_templates_update_own"
  ON meal_templates FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "meal_templates_delete_own"
  ON meal_templates FOR DELETE
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3. meal_template_foods — foods in a template
-- -----------------------------------------------------------------------------

CREATE TABLE meal_template_foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES meal_templates(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 1,
  serving_unit text NOT NULL CHECK (serving_unit IN ('g', 'oz'))
);

CREATE INDEX idx_meal_template_foods_template_id ON meal_template_foods(template_id);

ALTER TABLE meal_template_foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mtf_select_own"
  ON meal_template_foods FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meal_templates mt
      WHERE mt.id = meal_template_foods.template_id AND mt.user_id = auth.uid()
    )
  );

CREATE POLICY "mtf_insert_own"
  ON meal_template_foods FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meal_templates mt
      WHERE mt.id = template_id AND mt.user_id = auth.uid()
    )
  );

CREATE POLICY "mtf_update_own"
  ON meal_template_foods FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM meal_templates mt
      WHERE mt.id = meal_template_foods.template_id AND mt.user_id = auth.uid()
    )
  );

CREATE POLICY "mtf_delete_own"
  ON meal_template_foods FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM meal_templates mt
      WHERE mt.id = meal_template_foods.template_id AND mt.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 4. daily_food_logs
-- -----------------------------------------------------------------------------

CREATE TABLE daily_food_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  logged_date date NOT NULL,
  meal_slot integer NOT NULL CHECK (meal_slot BETWEEN 1 AND 6),
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  quantity numeric NOT NULL,
  serving_unit text NOT NULL CHECK (serving_unit IN ('g', 'oz')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN daily_food_logs.meal_slot IS '1–5 = Meal 1–5; 6 = Snacks.';

CREATE INDEX idx_daily_food_logs_user_date ON daily_food_logs(user_id, logged_date);

ALTER TABLE daily_food_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_food_logs_select_own"
  ON daily_food_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "daily_food_logs_insert_own"
  ON daily_food_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "daily_food_logs_update_own"
  ON daily_food_logs FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "daily_food_logs_delete_own"
  ON daily_food_logs FOR DELETE
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 5. nutrition_goals
-- -----------------------------------------------------------------------------

CREATE TABLE nutrition_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  daily_calories numeric NOT NULL,
  protein_pct numeric NOT NULL DEFAULT 30,
  carbs_pct numeric NOT NULL DEFAULT 40,
  fat_pct numeric NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE nutrition_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutrition_goals_select_own"
  ON nutrition_goals FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "nutrition_goals_insert_own"
  ON nutrition_goals FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "nutrition_goals_update_own"
  ON nutrition_goals FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "nutrition_goals_delete_own"
  ON nutrition_goals FOR DELETE
  USING (user_id = auth.uid());

CREATE TRIGGER set_nutrition_goals_updated_at
  BEFORE UPDATE ON nutrition_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Seed: 20 public library foods (user_id NULL, is_public true)
-- Macros are approximate per stated serving (USDA-style).
-- -----------------------------------------------------------------------------

INSERT INTO foods (user_id, name, brand, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, is_public) VALUES
  (NULL, 'Chicken breast, cooked', NULL, 100, 'g', 165, 31, 0, 3.6, true),
  (NULL, 'Egg, large', NULL, 50, 'g', 72, 6.3, 0.4, 4.8, true),
  (NULL, 'White rice, cooked', NULL, 100, 'g', 130, 2.7, 28, 0.3, true),
  (NULL, 'Rolled oats, dry', NULL, 40, 'g', 150, 5, 27, 3, true),
  (NULL, 'Banana, medium', NULL, 118, 'g', 105, 1.3, 27, 0.4, true),
  (NULL, 'Greek yogurt, nonfat plain', NULL, 170, 'g', 100, 17, 6, 0, true),
  (NULL, 'Salmon, Atlantic cooked', NULL, 100, 'g', 208, 20, 0, 13, true),
  (NULL, 'Whole milk', NULL, 244, 'g', 150, 8, 12, 8, true),
  (NULL, 'Broccoli, cooked', NULL, 100, 'g', 34, 2.8, 7, 0.4, true),
  (NULL, 'Sweet potato, baked', NULL, 100, 'g', 90, 2, 21, 0.2, true),
  (NULL, 'Almonds', NULL, 28, 'g', 164, 6, 6, 14, true),
  (NULL, 'Peanut butter', NULL, 32, 'g', 188, 8, 6, 16, true),
  (NULL, 'Apple, medium', NULL, 182, 'g', 95, 0.5, 25, 0.3, true),
  (NULL, 'Ground beef 90/10, cooked', NULL, 100, 'g', 214, 26, 0, 11, true),
  (NULL, 'Pasta, cooked', NULL, 100, 'g', 131, 5, 25, 1.1, true),
  (NULL, 'Avocado', NULL, 100, 'g', 160, 2, 9, 15, true),
  (NULL, 'Tuna, canned in water', NULL, 100, 'g', 116, 26, 0, 0.8, true),
  (NULL, 'Cottage cheese, lowfat', NULL, 113, 'g', 92, 12, 5, 2.5, true),
  (NULL, 'Whey protein powder', NULL, 30, 'g', 120, 24, 3, 1.5, true),
  (NULL, 'Whole wheat bread', NULL, 43, 'g', 110, 5, 19, 2, true);

-- Reminder: apply via Supabase SQL Editor or `supabase db push`.
