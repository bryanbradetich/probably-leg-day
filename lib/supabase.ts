/**
 * Supabase client setup.
 * - Client components: import { createClient } from "@/lib/supabase" (uses createBrowserClient from @supabase/ssr).
 * - Server components/actions: import { createClient } from "@/lib/supabase/server" (uses createServerClient from @supabase/ssr).
 */
export { createClient } from "./supabase/client";
