-- Persist UI theme choice on user profile

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'dark-orange';

COMMENT ON COLUMN profiles.theme IS 'UI theme id: dark-orange, dark-blue, dark-purple, light-clean, high-contrast, mets, ducks.';
