/**
 * Reads Supabase env vars and throws a clear error if missing.
 * Use this in both client and server Supabase setup so the project URL and anon key
 * are always defined when creating a client.
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (see .env.local.example)."
    );
  }
  return { url, key };
}
