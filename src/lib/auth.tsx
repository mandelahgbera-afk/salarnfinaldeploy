import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface AppUser {
  id: string;
  auth_id: string | null;
  email: string;
  full_name: string | null;
  role: 'user' | 'admin';
  wallet_address?: string | null;
}

export interface OutletContext {
  user: AppUser | null;
}

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  isLoading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null; sessionCreated?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updateProfile: (data: { full_name?: string }) => Promise<{ error: Error | null }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === 'string') return new Error(err);
  try { return new Error(JSON.stringify(err)); } catch { return new Error('Unknown error'); }
}

function getAppOrigin(): string {
  const envUrl = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/+$/, '');
  return envUrl || window.location.origin;
}

function normalizeSignupError(
  error: { message?: string; status?: number; code?: string } | null,
  redirectTo?: string,
): Error | null {
  if (!error) return null;

  const rawMsg = (error.message ?? '').trim();
  const status  = error.status;
  const code    = (error.code ?? '').toLowerCase();
  const lower   = rawMsg.toLowerCase();

  // ── Specific known error codes from GoTrue ──────────────────
  if (code === 'over_email_send_rate_limit' || lower.includes('email rate limit') || lower.includes('over_email_send_rate_limit')) {
    return new Error('Email rate limit hit. Wait a few minutes and try again.');
  }

  if (code === 'weak_password' || lower.includes('weak password') || lower.includes('should be at least')) {
    return new Error('Password is too weak. Use at least 8 characters with a mix of letters and numbers.');
  }

  if (
    lower.includes('redirect') &&
    (lower.includes('not allowed') || lower.includes('invalid') || lower.includes('mismatch'))
  ) {
    const hint = redirectTo
      ? ` Add "${redirectTo}" to Supabase → Auth → URL Configuration → Additional Redirect URLs.`
      : ' Go to Supabase → Auth → URL Configuration and add your domain to Additional Redirect URLs.';
    return new Error(`Redirect URL not allowed.${hint}`);
  }

  if (lower.includes('already registered') || lower.includes('user already exists')) {
    return new Error('An account with this email already exists. Please sign in instead.');
  }

  if (
    lower.includes('smtp') ||
    lower.includes('sending') ||
    lower.includes('email could not be') ||
    lower.includes('failed to send') ||
    lower.includes('unable to send')
  ) {
    return new Error(
      'Supabase could not send the confirmation email. ' +
      'Check Auth → SMTP Settings in your Supabase dashboard, or temporarily disable email confirmation for testing.',
    );
  }

  if (lower.includes('rate limit') || lower.includes('too many request')) {
    return new Error('Too many attempts. Wait a few minutes and try again.');
  }

  if (lower.includes('invalid email') || lower.includes('unable to validate')) {
    return new Error('Invalid email address. Please check and try again.');
  }

  // ── Empty / unparseable body → HTTP status decides the message ──
  const isEmptyBody = !rawMsg || rawMsg === '{}' || rawMsg === '[]' || rawMsg === 'null' || rawMsg.length < 3;
  if (isEmptyBody) {
    if (status === 429) return new Error('Too many signup attempts. Wait a few minutes and try again.');
    if (status === 422 || status === 400) return new Error('Invalid email or password. Please check and try again.');
    if (status && status >= 500) {
      return new Error(
        'Supabase email delivery failed (server error). ' +
        'In your Supabase dashboard → Auth → SMTP Settings, verify your credentials or disable email confirmation to test without SMTP.',
      );
    }
    return new Error(
      `Signup failed (status ${status ?? 'unknown'}). ` +
      'Check your Supabase SMTP settings and email templates.',
    );
  }

  return new Error(rawMsg);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const lastLoadedAuthId      = useRef<string | null>(null);
  const userRef               = useRef<AppUser | null>(null);
  const listenerFired         = useRef(false);
  /**
   * CRITICAL: Set to true BEFORE calling any supabase.auth.signIn* / signUp call
   * so the onAuthStateChange listener skips its own fetchAppUser. The supabase-js
   * client fires onAuthStateChange DURING the await (before the Promise resolves),
   * so setting the flag after the await is always too late.
   */
  const signInFetchInProgress = useRef(false);
  const mountedRef            = useRef(true);

  useEffect(() => { userRef.current = user; }, [user]);

  const fetchAppUser = useCallback(async (authUser: User): Promise<AppUser> => {
    const minimal: AppUser = {
      id:        authUser.id,
      auth_id:   authUser.id,
      email:     authUser.email!,
      full_name: authUser.user_metadata?.full_name ?? null,
      role:      'user',
    };

    try {
      type ProfileRow = Record<string, unknown>;

      // 1. Look up by auth_id (most reliable — avoids email-collision edge cases)
      const { data: byAuthId } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authUser.id)
        .maybeSingle();

      let row: ProfileRow | null = byAuthId as ProfileRow | null;

      // 2. Fall back to email lookup (handles rows created before auth_id was backfilled)
      if (!row) {
        const { data: byEmail } = await supabase
          .from('users')
          .select('*')
          .eq('email', authUser.email!)
          .maybeSingle();
        row = byEmail as ProfileRow | null;
      }

      if (row) {
        // Backfill auth_id if the row was created without it
        if (!row['auth_id']) {
          supabase
            .from('users')
            .update({ auth_id: authUser.id })
            .eq('id', row['id'])
            .then(() => {});
        }
        return { ...row, auth_id: row['auth_id'] ?? authUser.id } as unknown as AppUser;
      }

      // 3. No row at all — create one. Use email as conflict target so we never
      //    produce a duplicate-email error if the trigger already ran with a
      //    different auth_id value.
      const { data: newRow } = await supabase
        .from('users')
        .upsert(
          {
            auth_id:   authUser.id,
            email:     authUser.email!,
            full_name: authUser.user_metadata?.full_name ?? null,
            role:      'user',
          },
          { onConflict: 'email' },
        )
        .select()
        .maybeSingle();

      // Also ensure balance row exists (idempotent)
      supabase
        .from('user_balances')
        .upsert(
          { user_email: authUser.email!, balance_usd: 0, total_invested: 0, total_profit_loss: 0 },
          { onConflict: 'user_email' },
        )
        .then(() => {});

      return (newRow as unknown as AppUser) ?? minimal;
    } catch (err) {
      console.warn('[Salarn] fetchAppUser error (using minimal fallback):', err);
      return minimal;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const { data: { session: current } } = await supabase.auth.getSession();
    if (current?.user && mountedRef.current) {
      lastLoadedAuthId.current = null;
      const appUser = await fetchAppUser(current.user);
      if (mountedRef.current) setUser(appUser);
    }
  }, [fetchAppUser]);

  useEffect(() => {
    mountedRef.current = true;

    // ── 1. Register listener FIRST so no event is ever missed ──────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mountedRef.current) return;

      listenerFired.current = true;
      setSession(newSession);

      // No session → signed out
      if (!newSession?.user) {
        lastLoadedAuthId.current = null;
        setUser(null);
        if (mountedRef.current) setIsLoading(false);
        return;
      }

      // signIn() / signUp() set this flag BEFORE calling supabase so we don't
      // double-fetch when the event fires during their own await.
      if (signInFetchInProgress.current) {
        if (mountedRef.current) setIsLoading(false);
        return;
      }

      // Token refresh — user already in memory, no fetch needed
      if (
        event === 'TOKEN_REFRESHED' &&
        lastLoadedAuthId.current === newSession.user.id &&
        userRef.current !== null
      ) {
        if (mountedRef.current) setIsLoading(false);
        return;
      }

      // Same user already loaded (e.g. verifyOtp after withdrawal OTP)
      if (
        event === 'SIGNED_IN' &&
        lastLoadedAuthId.current === newSession.user.id &&
        userRef.current !== null
      ) {
        setSession(newSession);
        if (mountedRef.current) setIsLoading(false);
        return;
      }

      lastLoadedAuthId.current = newSession.user.id;
      const appUser = await fetchAppUser(newSession.user);

      if (mountedRef.current) {
        setUser(appUser);
        setIsLoading(false);
      }
    });

    // ── 2. Check existing session (in case the listener already fired) ─────
    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!mountedRef.current) return;

        // Listener already handled state — just clear the spinner
        if (listenerFired.current) {
          if (mountedRef.current) setIsLoading(false);
          return;
        }

        if (currentSession?.user) {
          setSession(currentSession);
          lastLoadedAuthId.current = currentSession.user.id;
          const appUser = await fetchAppUser(currentSession.user);
          if (mountedRef.current && !listenerFired.current) {
            setUser(appUser);
            setIsLoading(false);
          }
        } else {
          if (mountedRef.current && !listenerFired.current) {
            setUser(null);
            setSession(null);
            setIsLoading(false);
          }
        }
      } catch {
        if (mountedRef.current) setIsLoading(false);
      }
    };

    initAuth();

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAppUser]);

  // ── signUp ────────────────────────────────────────────────────────────────
  const signUp = async (email: string, password: string, fullName: string) => {
    const origin     = getAppOrigin();
    const redirectTo = `${origin}/auth/callback`;

    // Set flag BEFORE the call — the listener fires DURING the await
    signInFetchInProgress.current = true;

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: { full_name: fullName },
        },
      });

      if (error) {
        console.error('[Salarn] signUp error', { message: error.message, status: (error as { status?: number }).status, code: (error as { code?: string }).code });
        signInFetchInProgress.current = false;
        return {
          error: normalizeSignupError(
            { message: error.message, status: (error as { status?: number }).status, code: (error as { code?: string }).code },
            redirectTo,
          ),
        };
      }

      // identities: [] → email already registered (Supabase silently returns a fake user)
      if (data?.user && data.user.identities?.length === 0) {
        signInFetchInProgress.current = false;
        return { error: new Error('An account with this email already exists. Please sign in instead.') };
      }

      const sessionCreated = !!(data?.session);

      if (sessionCreated && data?.user) {
        // Email confirmation is DISABLED — user is immediately signed in.
        // We handle the profile fetch here (listener is blocked by the flag).
        lastLoadedAuthId.current = data.user.id;
        const appUser = await fetchAppUser(data.user);
        if (mountedRef.current) {
          setUser(appUser);
          setSession(data.session);
        }
      }
      // If email confirmation is ENABLED, session is null. The listener will
      // handle the fetch when the user clicks the email link → AuthCallback.

      signInFetchInProgress.current = false;
      return { error: null, sessionCreated };
    } catch (err) {
      signInFetchInProgress.current = false;
      return { error: toError(err) };
    }
  };

  // ── signIn ────────────────────────────────────────────────────────────────
  const signIn = async (email: string, password: string) => {
    // Set flag BEFORE the call — the listener fires DURING the await
    signInFetchInProgress.current = true;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        signInFetchInProgress.current = false;
        return { error: toError(error) };
      }

      if (data?.user) {
        lastLoadedAuthId.current = data.user.id;
        const appUser = await fetchAppUser(data.user);

        // Ensure balance row exists (idempotent — handles accounts created before trigger)
        supabase
          .from('user_balances')
          .upsert(
            { user_email: data.user.email!, balance_usd: 0, total_invested: 0, total_profit_loss: 0 },
            { onConflict: 'user_email', ignoreDuplicates: true },
          )
          .then(() => {});

        if (mountedRef.current) {
          setUser(appUser);
          setSession(data.session);
        }
      }

      signInFetchInProgress.current = false;
      return { error: null };
    } catch (err) {
      signInFetchInProgress.current = false;
      return { error: toError(err) };
    }
  };

  // ── resetPassword ─────────────────────────────────────────────────────────
  const resetPassword = async (email: string) => {
    try {
      const origin = getAppOrigin();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/callback`,
      });
      return { error: error ? toError(error) : null };
    } catch (err) {
      return { error: toError(err) };
    }
  };

  // ── signOut ───────────────────────────────────────────────────────────────
  const signOut = async () => {
    lastLoadedAuthId.current      = null;
    listenerFired.current         = false;
    signInFetchInProgress.current = false;
    if (mountedRef.current) {
      setIsLoading(false);
      setUser(null);
      setSession(null);
    }
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
  };

  // ── updateProfile ─────────────────────────────────────────────────────────
  const updateProfile = async (data: { full_name?: string }) => {
    if (!user) return { error: new Error('Not authenticated') };
    try {
      const { error } = await supabase
        .from('users')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (!error && mountedRef.current) setUser(prev => prev ? { ...prev, ...data } : null);
      return { error: error ? toError(error) : null };
    } catch (err) {
      return { error: toError(err) };
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signUp, signIn, signOut, resetPassword, updateProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
