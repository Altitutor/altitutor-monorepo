import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';
import { topicsFilesKeys } from '../../topics/hooks/useTopicsFilesQuery';

export type TopicFileWithFile = Tables<'topics_files'> & {
  file: Tables<'files'>;
};

/**
 * Hook to fetch topic files for multiple topics by their IDs
 * Returns a map of topic ID to array of topic files
 */
export function useTopicFilesByTopicIds(topicIds: string[]) {
  return useQuery({
    queryKey: [...topicsFilesKeys.all, 'byTopicIds', topicIds.sort().join(',')],
    queryFn: async (): Promise<Record<string, TopicFileWithFile[]>> => {
      if (topicIds.length === 0) {
        return {};
      }

      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const filesMap: Record<string, TopicFileWithFile[]> = {};

      try {
        // Get files for each topic with file details
        for (const topicId of topicIds) {
          const { data, error } = await supabase
            .from('topics_files')
            .select(`
              *,
              file:files(*)
            `)
            .eq('topic_id', topicId)
            .order('type')
            .order('index');

          if (error) {
            console.error(`Error fetching topic files for topic ${topicId}:`, error);
            continue;
          }

          filesMap[topicId] = (data || []) as TopicFileWithFile[];
        }

        return filesMap;
      } catch (error) {
        console.error('Error fetching topic files by topic IDs:', error);
        throw error;
      }
    },
    enabled: topicIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}
