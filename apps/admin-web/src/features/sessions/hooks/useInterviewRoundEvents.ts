import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { interviewRoundFromRow } from '../utils/interviewRoundEvents';

export function useInterviewRoundEvents(rangeStart: string, rangeEnd: string) {
  return useQuery({
    queryKey: ['interview-round-events', rangeStart, rangeEnd],
    queryFn: async () => {
      const start = new Date(`${rangeStart}T00:00:00`);
      const end = new Date(`${rangeEnd}T23:59:59.999`);
      const { data, error } = await getSupabaseClient()
        .from('interview_rounds')
        .select('id, data')
        .filter('data->>scheduledAt', 'gte', start.toISOString())
        .filter('data->>scheduledAt', 'lte', end.toISOString());
      if (error) throw error;
      return (data ?? []).flatMap((row) => {
        const event = interviewRoundFromRow(row);
        if (!event) return [];
        const when = new Date(event.scheduledAt);
        return when >= start && when <= end ? [event] : [];
      });
    },
    staleTime: 30_000,
  });
}
