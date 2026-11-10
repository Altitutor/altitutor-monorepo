import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

export function useSessionTopics(logIds: string[]) {
  return useQuery({
    queryKey: ['tutor-log-topics', logIds],
    enabled: logIds.length > 0,
    queryFn: async () => {
      const db = getSupabaseClient();
      const { data, error } = await db.from('tutor_logs_topics')
        .select('tutor_log_id, topic:topics(name)').in('tutor_log_id', logIds);
      if (error) throw error;
      const topics: Record<string, string[]> = {};
      for (const row of data) {
        if (row.tutor_log_id && row.topic?.name) (topics[row.tutor_log_id] ??= []).push(row.topic.name);
      }
      return topics;
    },
  });
}
