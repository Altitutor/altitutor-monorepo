import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/providers/auth-provider';

import { getSession, listUnloggedSessions } from './api';

export const operationsKey = ['tutor', 'operations'] as const;
export const sessionKey = (sessionId: string) => [...operationsKey, 'session', sessionId] as const;
export const notesKey = (sessionId: string) => [...operationsKey, 'notes', sessionId] as const;
export const planKey = (sessionId: string) => [...operationsKey, 'plan', sessionId] as const;

export function useSession(sessionId: string) {
  return useQuery({ queryKey: sessionKey(sessionId), queryFn: () => getSession(sessionId), enabled: Boolean(sessionId) });
}

export function useUnloggedSessions(enabled = true) {
  const { profile } = useAuth();
  const staffId = profile?.status === 'ACTIVE' ? profile.id : null;
  return useQuery({
    queryKey: [...operationsKey, 'unlogged', staffId],
    queryFn: () => listUnloggedSessions(staffId ?? ''),
    enabled: enabled && Boolean(staffId),
  });
}
