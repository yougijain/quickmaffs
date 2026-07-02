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
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
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
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (data.session) triggerSync();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, next) => {
      setSession(next);
      if (next) triggerSync();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      cloudEnabled,
      user: session?.user ?? null,
      session,
      loading,
      async signInWithPassword(email, password) {
        if (!supabase) return 'Cloud sync is not configured.';
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error?.message ?? null;
      },
      async signUp(email, password) {
        if (!supabase) return 'Cloud sync is not configured.';
        const { error } = await supabase.auth.signUp({ email, password });
        return error?.message ?? null;
      },
      async signInWithMagicLink(email) {
        if (!supabase) return 'Cloud sync is not configured.';
        const { error } = await supabase.auth.signInWithOtp({ email });
        return error?.message ?? null;
      },
      async signOut() {
        await supabase?.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
