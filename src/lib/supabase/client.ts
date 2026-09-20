'use client';

import { createBrowserClient } from '@supabase/ssr';
import { supabasePublishableKey, supabaseUrl } from '@/lib/env';

/** Supabase client for browser components. Carries the signed-in user's session. */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabasePublishableKey());
}
