import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, cloudEnabled } from '../lib/env';

/**
 * Single shared client, or null when cloud sync isn't configured. All callers
 * must handle the null case so the app works in local-only mode.
 */
export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
