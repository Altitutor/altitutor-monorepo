import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';
import { topicsKeys } from '../../topics/hooks/useTopicsQuery';

export interface TopicWithSubject extends Tables<'topics'> {
  subject: Tables<'subjects'> | null;
}

/**
 * Hook to fetch topics with their subjects by topic IDs
 * Returns a map of topic ID to subject for efficient lookup
 */
export function useTopicsWithSubjects(topicIds: string[]) {
  return useQuery({
    queryKey: [...topicsKeys.all, 'withSubjects', topicIds.sort().join(',')],
    queryFn: async (): Promise<Map<string, Tables<'subjects'>>> => {
      if (topicIds.length === 0) {
        return new Map();
      }

      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const { data, error } = await supabase
        .from('topics')
        .select('id, subject_id, subjects:subjects(*)')
        .in('id', topicIds);

      if (error) {
        console.error('Error fetching topics with subjects:', error);
        throw error;
      }

      const subjectsMap = new Map<string, Tables<'subjects'>>();
      if (data) {
        data.forEach((topic: any) => {
          if (topic.subjects && topic.subject_id) {
            subjectsMap.set(topic.subject_id, topic.subjects);
          }
        });
      }

      return subjectsMap;
    },
    enabled: topicIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}
