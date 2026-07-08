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
      }
      // Otherwise stay signed-out and play locally. An anonymous account is
      // created lazily on the first session save (see sync.pushPending), so
      // merely opening the app never mints an empty account.
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
        const { data: current } = await supabase.auth.getUser();
        if (current.user) {
          // Convert the existing (anonymous) session into an email account,
          // keeping its local data. Sign-in elsewhere then needs no email.
          const { error } = await supabase.auth.updateUser(
            { email, password },
            { emailRedirectTo: appUrl() },
          );
          return error?.message ?? null;
        }
        // No session yet — create a fresh email account; local history syncs up.
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: appUrl() },
        });
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
        // Sign out only. Local play continues; a fresh anonymous identity is
        // created lazily if/when there's new data to sync.
        await supabase?.auth.signOut();
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
