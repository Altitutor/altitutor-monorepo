import { useMemo } from 'react';
import type { Tables } from '@altitutor/shared';
import { useTopicsByIds } from '@/features/topics/hooks/useTopicsQuery';
import { useTutorLogStudents } from './useTutorLogStudents';

export type TutorLogStep5Data = {
  topicsData: Tables<'topics'>[];
  studentsData: Tables<'students'>[];
  isLoading: boolean;
};

export function useTutorLogStep5Data(
  topicIds: string[],
  attendedStudentIds: string[]
): TutorLogStep5Data {
  const { data: topicsRaw = [], isLoading: isLoadingTopics } = useTopicsByIds(topicIds);
  const { data: studentsRaw = [], isLoading: isLoadingStudents } =
    useTutorLogStudents(attendedStudentIds);

  return useMemo(() => {
    const topicsData = (topicsRaw || []).filter(
      (t): t is Tables<'topics'> =>
        t.id != null && t.name != null && t.subject_id != null
    );
    const studentsData = (studentsRaw || []) as Tables<'students'>[];

    return {
      topicsData,
      studentsData,
      isLoading: (topicIds.length > 0 && isLoadingTopics) || isLoadingStudents,
    };
  }, [topicsRaw, studentsRaw, isLoadingTopics, isLoadingStudents, topicIds.length]);
}
