-- Dynamic vs static calorie targets on nutrition_goals

ALTER TABLE nutrition_goals
  ADD COLUMN IF NOT EXISTS calorie_mode text NOT NULL DEFAULT 'static'
    CHECK (calorie_mode IN ('static', 'dynamic')),
  ADD COLUMN IF NOT EXISTS daily_deficit_surplus numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN nutrition_goals.calorie_mode IS
  'static: use daily_calories; dynamic: TDEE + extra burns + deficit/surplus from weight goal or daily_deficit_surplus.';
COMMENT ON COLUMN nutrition_goals.daily_deficit_surplus IS
  'Kcal offset from TDEE + logged burns when calorie_mode = dynamic and no active weight goal; negative deficit, positive surplus.';
