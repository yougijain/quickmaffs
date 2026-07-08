import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../data/supabase';
import { cloudEnabled } from '../lib/env';
import { installSyncListeners, triggerSync } from '../data/sync';

interface AuthContextValue {
  cloudEnabled: boolean;
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** True while signed in only as an anonymous (not yet email-backed) user. */
  isAnonymous: boolean;
  /** Convert the current anonymous account into an email-backed one. */
  backUpToEmail: (email: string) => Promise<string | null>;
  signInWithMagicLink: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(cloudEnabled);

  useEffect(() => {
    if (!supabase) return;
    installSyncListeners();
    const sb = supabase;

    (async () => {
      const { data } = await sb.auth.getSession();
      if (data.session) {
        setSession(data.session);
        triggerSync();
      } else {
        // Frictionless: silently create an anonymous account so sync just works.
        // Requires "Allow anonymous sign-ins" enabled in the project's auth config.
        const { error } = await sb.auth.signInAnonymously();
        if (error) console.warn('anon sign-in failed:', error.message);
      }
      setLoading(false);
    })();

    const { data: sub } = sb.auth.onAuthStateChange((_evt, next) => {
      setSession(next);
      if (next) triggerSync();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;
  const isAnonymous = Boolean(user?.is_anonymous);

  const value = useMemo<AuthContextValue>(
    () => ({
      cloudEnabled,
      user,
      session,
      loading,
      isAnonymous,
      async backUpToEmail(email) {
        if (!supabase) return 'Cloud sync is not configured.';
        // Attaches an email to the (possibly anonymous) account and sends a
        // confirmation link. After confirming, the same account is reachable
        // from any device via a magic link to that address.
        const { error } = await supabase.auth.updateUser({ email });
        return error?.message ?? null;
      },
      async signInWithMagicLink(email) {
        if (!supabase) return 'Cloud sync is not configured.';
        const { error } = await supabase.auth.signInWithOtp({ email });
        return error?.message ?? null;
      },
      async signOut() {
        await supabase?.auth.signOut();
        // Immediately re-establish an anonymous session so local play keeps syncing.
        await supabase?.auth.signInAnonymously();
      },
    }),
    [session, loading, user, isAnonymous],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
