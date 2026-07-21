import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, cloudEnabled } from '../lib/env';

/**
 * Single shared client, or null when cloud sync isn't configured. All callers
 * must handle the null case so the app works in local-only mode.
 */
export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Parse tokens from the URL when returning from an email link, even
        // though the app uses a hash router. supabase-js consumes the auth
        // params and cleans the URL before the router reads the route.
        detectSessionInUrl: true,
        flowType: 'implicit',
      },
    })
  : null;
