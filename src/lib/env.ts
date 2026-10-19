// Supabase config is optional: with these unset the app runs fully in
// anonymous, local-only mode (all features work; nothing syncs to the cloud).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const SUPABASE_URL = url ?? '';
export const SUPABASE_ANON_KEY = anonKey ?? '';

/** True when cloud sync is configured and available. */
export const cloudEnabled = Boolean(url && anonKey);
