import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../data/supabase';
import { cloudEnabled } from '../lib/env';
import { installSyncListeners, syncBoth, triggerSync } from '../data/sync';

interface AuthContextValue {
  cloudEnabled: boolean;
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** True while signed in only as an anonymous (not yet email-backed) user. */
  isAnonymous: boolean;
  /** Attach an email + password to the current (anonymous) account. */
  backUpToEmail: (email: string, password: string) => Promise<string | null>;
  /** Set/replace the password on the signed-in account. */
  setPassword: (password: string) => Promise<string | null>;
  /** Sign in with email + password — fully in-app, no email round-trip. */
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
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
        syncBoth(); // push local + pull cloud history
      } else {
        // Frictionless: silently create an anonymous account so sync just works.
        // Requires "Allow anonymous sign-ins" enabled in the project's auth config.
        const { error } = await sb.auth.signInAnonymously();
        if (error) console.warn('anon sign-in failed:', error.message);
      }
      setLoading(false);
    })();

    const { data: sub } = sb.auth.onAuthStateChange((evt, next) => {
      setSession(next);
      // On a real sign-in (e.g. magic link on a new device), pull history down.
      if (evt === 'SIGNED_IN') syncBoth();
      else if (next) triggerSync();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;
  const isAnonymous = Boolean(user?.is_anonymous);

  // Where email links should land: the exact URL the app is served from
  // (strip any hash-router fragment). Robust even if the dashboard Site URL
  // is misconfigured — the link comes back to wherever you actually are.
  const appUrl = () => (typeof window !== 'undefined' ? window.location.href.split('#')[0] : undefined);

  const value = useMemo<AuthContextValue>(
    () => ({
      cloudEnabled,
      user,
      session,
      loading,
      isAnonymous,
      async backUpToEmail(email, password) {
        if (!supabase) return 'Cloud sync is not configured.';
        // Attach email + password to the current account in one step. Sign-in
        // on other devices then needs no email at all (see signInWithPassword).
        const { error } = await supabase.auth.updateUser(
          { email, password },
          { emailRedirectTo: appUrl() },
        );
        return error?.message ?? null;
      },
      async setPassword(password) {
        if (!supabase) return 'Cloud sync is not configured.';
        const { error } = await supabase.auth.updateUser({ password });
        return error?.message ?? null;
      },
      async signInWithPassword(email, password) {
        if (!supabase) return 'Cloud sync is not configured.';
        const { error } = await supabase.auth.signInWithPassword({ email, password });
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
