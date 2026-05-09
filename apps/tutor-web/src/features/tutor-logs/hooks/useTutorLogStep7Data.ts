import { useMemo } from 'react';
import type { Tables } from '@altitutor/shared';
import { useTopicsByIds } from '@/features/topics/hooks/useTopicsQuery';
import { useTopicFilesByIds } from '@/features/topics/hooks/useTopicsFilesQuery';
import { useTutorLogStudents } from './useTutorLogStudents';

export type TutorLogStep7Data = {
  filesData: Tables<'topics_files'>[];
  topicsData: Tables<'topics'>[];
  studentsData: Tables<'students'>[];
  isLoading: boolean;
};

export function useTutorLogStep7Data(
  topicIds: string[],
  fileIds: string[],
  studentIds: string[]
): TutorLogStep7Data {
  const { data: topicsRaw = [], isLoading: isLoadingTopics } = useTopicsByIds(topicIds);
  const { data: filesRaw = [], isLoading: isLoadingFiles } = useTopicFilesByIds(fileIds);
  const { data: studentsRaw = [], isLoading: isLoadingStudents } =
    useTutorLogStudents(studentIds);

  return useMemo(() => {
    const topicsData = (topicsRaw || []).filter(
      (t): t is Tables<'topics'> =>
        t.id != null && t.name != null && t.subject_id != null
    );
    const filesData = (filesRaw || []).filter(
      (f) =>
        f.id != null &&
        f.file_id != null &&
        f.topic_id != null &&
        f.index != null &&
        f.code != null &&
        typeof f.type === 'string'
    ) as Tables<'topics_files'>[];
    const studentsData = (studentsRaw || []) as Tables<'students'>[];

    return {
      topicsData,
      filesData,
      studentsData,
      isLoading:
        (topicIds.length > 0 && isLoadingTopics) ||
        (fileIds.length > 0 && isLoadingFiles) ||
        isLoadingStudents,
    };
  }, [
    topicsRaw,
    filesRaw,
    studentsRaw,
    isLoadingTopics,
    isLoadingFiles,
    isLoadingStudents,
    topicIds.length,
    fileIds.length,
  ]);
}
