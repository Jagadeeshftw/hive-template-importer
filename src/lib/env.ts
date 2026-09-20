/**
 * Env access in one place, so a missing value fails loudly at the call site
 * instead of surfacing as an opaque Supabase error later.
 *
 * These are the current-generation Supabase API keys (`sb_publishable_...` and
 * `sb_secret_...`), not the deprecated anon/service_role JWTs.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export function supabaseUrl(): string {
  return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
}

/** Publishable key. Safe to ship to the browser — RLS is what protects the data. */
export function supabasePublishableKey(): string {
  return required(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

/** Secret key. Bypasses RLS, so it must never reach the browser. */
export function supabaseSecretKey(): string {
  return required('SUPABASE_SECRET_KEY', process.env.SUPABASE_SECRET_KEY);
}
