import { useQueries } from '@tanstack/react-query';
import type { Tables } from '@altitutor/shared';
import { useTopicsByIds } from '@/features/topics/hooks/useTopicsQuery';
import { topicsFilesApi } from '@/features/topics/api/topics-files';

export type TutorLogStep6Data = {
  topicsData: Tables<'topics'>[];
  filesData: Record<string, Tables<'topics_files'>[]>;
  isLoading: boolean;
};

export function useTutorLogStep6Data(topicIds: string[]): TutorLogStep6Data {
  const { data: topicsRaw = [], isLoading: isLoadingTopics } = useTopicsByIds(topicIds);

  const fileQueries = useQueries({
    queries: topicIds.map((topicId) => ({
      queryKey: ['topics-files', 'topic', topicId],
      queryFn: () => topicsFilesApi.getTopicFilesByTopic(topicId),
      enabled: topicIds.length > 0,
      staleTime: 1000 * 60 * 3,
    })),
  });

  const topicsData = (topicsRaw || []).filter(
    (t): t is Tables<'topics'> => t.id != null && t.name != null
  );

  const filesData: Record<string, Tables<'topics_files'>[]> = {};
  topicIds.forEach((topicId, i) => {
    const result = fileQueries[i]?.data;
    filesData[topicId] = (result || []) as Tables<'topics_files'>[];
  });

  const isLoadingFiles = fileQueries.some((q) => q.isLoading);
  const isLoading = (topicIds.length > 0 && isLoadingTopics) || isLoadingFiles;

  return {
    topicsData,
    filesData,
    isLoading,
  };
}
