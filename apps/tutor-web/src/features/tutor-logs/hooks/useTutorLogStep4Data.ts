import { useMemo } from 'react';
import type { Tables } from '@altitutor/shared';
import { useSession } from '@/features/sessions/hooks/useSessionsQuery';
import { useTopics, useTopicsBySubject } from '@/features/topics/hooks/useTopicsQuery';
import { useSubjects } from '@/features/subjects/hooks/useSubjectsQuery';

const isValidTopic = (
  t: unknown
): t is Tables<'topics'> => {
  const topic = t as Record<string, unknown>;
  return (
    topic != null &&
    typeof topic.id === 'string' &&
    typeof topic.name === 'string' &&
    typeof topic.index === 'number' &&
    typeof topic.subject_id === 'string'
  );
};

export type TutorLogStep4Data = {
  subjectTopics: Tables<'topics'>[];
  allTopics: Tables<'topics'>[];
  subjectsMap: Map<string, Tables<'subjects'>>;
  isLoading: boolean;
  error: Error | null;
};

/**
 * Fetches session, topics, and subjects data for tutor log Step 4 (topics selection).
 * Uses React Query hooks from sessions, topics, and subjects features.
 */
export function useTutorLogStep4Data(sessionId: string): TutorLogStep4Data {
  const { data: session, isLoading: isLoadingSession } = useSession(sessionId);
  const subjectId = session?.subject_id ?? null;
  const { data: topicsBySubject = [], isLoading: isLoadingSubjectTopics } =
    useTopicsBySubject(subjectId);
  const { data: allTopicsRaw = [], isLoading: isLoadingAllTopics } = useTopics();
  const { data: allSubjectsRaw = [], isLoading: isLoadingSubjects } = useSubjects();

  return useMemo(() => {
    const isLoading =
      isLoadingSession ||
      (!!subjectId && isLoadingSubjectTopics) ||
      isLoadingAllTopics ||
      isLoadingSubjects;

    const subjectTopics = (topicsBySubject || []).filter(isValidTopic);
    const allTopics = (allTopicsRaw || []).filter(isValidTopic);

    const subjectIds = [
      ...new Set(
        allTopics
          .map((t) => t.subject_id)
          .filter((id): id is string => id != null)
      ),
    ];

    const subjectsMap = new Map<string, Tables<'subjects'>>();
    (allSubjectsRaw || []).forEach((s) => {
      if (s?.id && subjectIds.includes(s.id)) {
        subjectsMap.set(s.id, s as Tables<'subjects'>);
      }
    });

    return {
      subjectTopics,
      allTopics,
      subjectsMap,
      isLoading,
      error: null,
    };
  }, [
    subjectId,
    topicsBySubject,
    allTopicsRaw,
    allSubjectsRaw,
    isLoadingSession,
    isLoadingSubjectTopics,
    isLoadingAllTopics,
    isLoadingSubjects,
  ]);
}
