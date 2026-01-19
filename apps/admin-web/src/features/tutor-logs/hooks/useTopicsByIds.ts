import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';
import { topicsKeys } from '../../topics/hooks/useTopicsQuery';

/**
 * Hook to fetch multiple topics by their IDs
 */
export function useTopicsByIds(topicIds: string[]) {
  return useQuery({
    queryKey: [...topicsKeys.all, 'byIds', topicIds.sort().join(',')],
    queryFn: async (): Promise<Tables<'topics'>[]> => {
      if (topicIds.length === 0) {
        return [];
      }

      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .in('id', topicIds);

      if (error) {
        console.error('Error fetching topics by IDs:', error);
        throw error;
      }

      return (data ?? []) as Tables<'topics'>[];
    },
    enabled: topicIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}
