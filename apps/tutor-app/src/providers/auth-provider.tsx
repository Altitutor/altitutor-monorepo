import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, use, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { loadTutorProfile, type TutorProfile } from '@/features/auth/tutor-access';
import { disablePushNotifications } from '@/features/notifications/push-registration';
import { hasPendingSignOut, setPendingSignOut, supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  profile: TutorProfile | null;
  status: 'loading' | 'signed-out' | 'allowed' | 'denied' | 'unavailable' | 'sign-out-pending';
  signOutBusy: boolean;
  signOutError: string | null;
  retry: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queries = useQueryClient();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [signOutState, setSignOutState] = useState<{ userId: string; busy: boolean; error: string | null } | null>(null);
  const signOutRequest = useRef<Promise<void> | null>(null);
  const activeUser = useRef<string | undefined>(undefined);
  const userId = session?.user.id;
  const pendingSignOut = useQuery({
    queryKey: ['tutor-sign-out', userId],
    enabled: Boolean(userId),
    queryFn: () => hasPendingSignOut(userId!),
    staleTime: Infinity,
  });
  const leaving = Boolean(userId && (signOutState?.userId === userId || pendingSignOut.data));
  const access = useQuery({
    queryKey: ['tutor-profile', userId],
    enabled: Boolean(userId) && !leaving,
    queryFn: ({ signal }) => loadTutorProfile(userId!, signal),
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (activeUser.current !== next?.user.id) queries.clear();
      activeUser.current = next?.user.id;
      setSession(next);
    });

    if (process.env.EXPO_OS === 'web') return () => subscription.unsubscribe();

    const refresh = (state: string) => {
      if (state === 'active') {
        void supabase.auth.startAutoRefresh();
        void queries.invalidateQueries({ queryKey: ['tutor-profile'] });
      } else {
        void supabase.auth.stopAutoRefresh();
      }
    };
    refresh(AppState.currentState);
    const listener = AppState.addEventListener('change', refresh);
    return () => {
      subscription.unsubscribe();
      listener.remove();
      void supabase.auth.stopAutoRefresh();
    };
  }, [queries]);

  const status = session === undefined ? 'loading'
    : !session ? 'signed-out'
    : leaving ? 'sign-out-pending'
    : pendingSignOut.isPending ? 'loading'
    : pendingSignOut.isError ? 'unavailable'
    : access.isPending ? 'loading'
    : access.isError && !access.data ? 'unavailable'
    : access.data ? 'allowed'
    : 'denied';

  function signOut() {
    if (!userId) return Promise.resolve();
    if (signOutRequest.current) return signOutRequest.current;

    // Hide tutor data immediately and keep it locked across restarts until
    // the device registration and session can both be revoked.
    setSignOutState({ userId, busy: true, error: null });
    const request = (async () => {
      try {
        await setPendingSignOut(userId, true);
        await disablePushNotifications(userId);
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) throw error;
        await setPendingSignOut(userId, false);
        setSignOutState(null);
      } catch {
        setSignOutState({ userId, busy: false, error: 'Sign-out could not finish. Check your connection and try again.' });
      }
    })().finally(() => { signOutRequest.current = null; });
    signOutRequest.current = request;
    return request;
  }

  return (
    <AuthContext value={{
      session: session ?? null,
      profile: access.data ?? null,
      status,
      signOutBusy: Boolean(leaving && signOutState?.busy),
      signOutError: leaving ? signOutState?.error ?? null : null,
      retry: () => {
        if (pendingSignOut.isError) void pendingSignOut.refetch();
        else void access.refetch();
      },
      signOut,
    }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const auth = use(AuthContext);
  if (!auth) throw new Error('AuthProvider is missing.');
  return auth;
}
