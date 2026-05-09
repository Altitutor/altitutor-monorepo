import { useQuery } from '@tanstack/react-query';
import { studentSessionsApi } from '@/shared/api/sessions';
import type { FlattenedSessionDetail } from '../utils/session-helpers';

export function useSessionTutorLogResources(
  sessionId: string | null,
  sessionRow: FlattenedSessionDetail | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [
      'student',
      'session',
      sessionId,
      'tutor-log-resources',
      sessionRow?.subject_id,
      sessionRow?.subject_short_name,
    ],
    queryFn: () =>
      studentSessionsApi.getSessionTutorLogResources(sessionId!, {
        sessionSubjectId: sessionRow?.subject_id ?? null,
        sessionSubjectShortName: sessionRow?.subject_short_name ?? null,
      }),
    enabled: Boolean(sessionId && sessionRow && enabled),
    staleTime: 1000 * 60 * 2,
  });
}
