// ============================================================
// P2.1 — Web Auth session provider (email/password; no public signup)
// ============================================================

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  deriveWebAuthUiState,
  type WebAuthSessionSnapshot,
  type WebAuthUiState,
} from './authState';
import { normalizeAuthErrorMessage } from '../services/supabase/authErrors';
import { getSupabaseClient } from '../services/supabase/client.web';
import { loadSupabaseEnvFromProcess } from '../services/supabase/env';
import { clearLastSelectedSourceId } from '../utils/lastSource';
import { WEB_SIGNOUT_OPTIONS } from './webSignOutOptions';

interface WebAuthContextValue {
  ui: WebAuthUiState;
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  signOut: () => Promise<void>;
  signingIn: boolean;
}

const WebAuthContext = createContext<WebAuthContextValue | null>(null);

function sessionSnapshot(session: Session | null): WebAuthSessionSnapshot | null {
  if (!session?.user?.id) return null;
  return {
    userId: session.user.id,
    email: session.user.email ?? null,
  };
}

export function WebAuthProvider({ children }: { children: React.ReactNode }) {
  const env = useMemo(() => loadSupabaseEnvFromProcess(), []);
  const [sessionLoading, setSessionLoading] = useState(env.status === 'configured');
  const [session, setSession] = useState<WebAuthSessionSnapshot | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (env.status !== 'configured') {
      setSessionLoading(false);
      setSession(null);
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setSessionLoading(false);
      setSession(null);
      return;
    }

    let cancelled = false;
    setSessionLoading(true);

    client.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setSession(sessionSnapshot(data.session));
      })
      .catch(() => {
        if (cancelled) return;
        setSession(null);
      })
      .finally(() => {
        if (!cancelled) setSessionLoading(false);
      });

    const { data: sub } = client.auth.onAuthStateChange((_event, next) => {
      setSession(sessionSnapshot(next));
      setSessionLoading(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [env.status]);

  const ui = useMemo(
    () => deriveWebAuthUiState({ env, sessionLoading, session }),
    [env, sessionLoading, session],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const client = getSupabaseClient();
      if (!client) {
        return { ok: false as const, message: normalizeAuthErrorMessage('not configured') };
      }
      const trimmedEmail = email.trim();
      if (!trimmedEmail || !password) {
        return {
          ok: false as const,
          message: 'Nhập email và mật khẩu để đăng nhập.',
        };
      }

      setSigningIn(true);
      try {
        const { error } = await client.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) {
          return { ok: false as const, message: normalizeAuthErrorMessage(error) };
        }
        return { ok: true as const };
      } catch (err) {
        return { ok: false as const, message: normalizeAuthErrorMessage(err) };
      } finally {
        setSigningIn(false);
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    try {
      await clearLastSelectedSourceId();
      // Local scope only — other devices/browsers keep their sessions.
      await client.auth.signOut(WEB_SIGNOUT_OPTIONS);
    } catch {
      // UI still clears via auth state listener when possible
    }
  }, []);

  const value = useMemo(
    () => ({ ui, signIn, signOut, signingIn }),
    [ui, signIn, signOut, signingIn],
  );

  return <WebAuthContext.Provider value={value}>{children}</WebAuthContext.Provider>;
}

export function useWebAuth(): WebAuthContextValue {
  const ctx = useContext(WebAuthContext);
  if (!ctx) {
    throw new Error('useWebAuth must be used within WebAuthProvider');
  }
  return ctx;
}
