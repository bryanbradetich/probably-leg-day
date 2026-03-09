-- Allow unauthenticated signup flow to check username availability without exposing profiles.
-- Returns true if the username is available, false if already taken.

CREATE OR REPLACE FUNCTION public.check_username_available(check_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM profiles WHERE username = check_username LIMIT 1
  );
$$;

COMMENT ON FUNCTION public.check_username_available(text) IS 'Returns true if username is available for signup; used before registration.';

GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO authenticated;
