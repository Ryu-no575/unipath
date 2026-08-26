/**
 * Whether Supabase credentials are configured. Auth/DB-backed routes are
 * only reachable in practice once a developer has followed the setup steps
 * in .env.example — until then, code that touches Supabase must degrade
 * gracefully (treat the visitor as signed out) rather than crash, so the
 * pages that don't need auth (Landing, Explore, University Detail) keep
 * working exactly as before this feature was added.
 */
export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
