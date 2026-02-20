import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Tables } from '@altitutor/shared';
import { useSessionWithTutorLog } from './useSessionsQuery';
import { useTopicsBySubject } from '@/features/topics/hooks/useTopicsQuery';
import { classesApi } from '@/features/classes/api/classes';
import { sessionsApi } from '../api/sessions';

interface UseSessionDataProps {
  sessionId: string | null;
  enabled?: boolean;
}

/** Session with tutor log API result shape (session, sessionsStudents, sessionsStaff, tutorLog, notes) */
type SessionWithTutorLogResult = Awaited<
  ReturnType<typeof sessionsApi.getSessionWithTutorLog>
>;

interface UseSessionDataReturn {
  data: SessionWithTutorLogResult | null;
  isLoading: boolean;
  allTopics: Tables<'topics'>[];
  firstClassStaffId: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for loading session data, topics, and related information.
 * Uses React Query for caching and request deduplication.
 */
export function useSessionData({
  sessionId,
  enabled = true,
}: UseSessionDataProps): UseSessionDataReturn {
  const [delayedClear, setDelayedClear] = useState(false);

  const sessionQuery = useSessionWithTutorLog(sessionId, enabled);
  const session = sessionQuery.data?.session as
    | (SessionWithTutorLogResult['session'] & {
        subject?: { id: string } | null;
        class?: { subject?: { id: string } | null } | null;
      })
    | undefined;
  const subjectId = useMemo(
    () =>
      session?.subject?.id ?? session?.class?.subject?.id ?? null,
    [session?.subject?.id, session?.class?.subject?.id]
  );
  const classId =
    session?.type === 'CLASS' && session?.class_id ? session.class_id : null;

  const topicsQuery = useTopicsBySubject(subjectId);
  const allTopics = useMemo(
    () => (topicsQuery.data ?? []) as Tables<'topics'>[],
    [topicsQuery.data]
  );

  const classStaffQuery = useQuery({
    queryKey: ['classes', classId ?? '', 'staff'],
    queryFn: () => classesApi.getClassStaff(classId!),
    enabled: enabled && !!classId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
  const firstClassStaffId =
    classStaffQuery.data && classStaffQuery.data.length > 0
      ? classStaffQuery.data[0].id
      : null;

  // Delay clearing display data when modal closes to allow exit animation
  useEffect(() => {
    if (enabled) {
      setDelayedClear(false);
      return;
    }
    const timer = setTimeout(() => setDelayedClear(true), 300);
    return () => clearTimeout(timer);
  }, [enabled]);

  const isLoading =
    sessionQuery.isLoading ||
    (!!subjectId && topicsQuery.isLoading) ||
    (!!classId && classStaffQuery.isLoading);

  const data = !enabled && delayedClear ? null : sessionQuery.data ?? null;

  const refresh = async () => {
    await Promise.all([
      sessionQuery.refetch(),
      subjectId ? topicsQuery.refetch() : Promise.resolve(),
      classId ? classStaffQuery.refetch() : Promise.resolve(),
    ]);
  };

  return {
    data,
    isLoading: enabled ? isLoading : false,
    allTopics: !enabled && delayedClear ? [] : allTopics,
    firstClassStaffId: !enabled && delayedClear ? null : firstClassStaffId,
    refresh,
  };
}
