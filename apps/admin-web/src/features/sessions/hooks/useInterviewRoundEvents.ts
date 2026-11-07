import { useQuery } from "@tanstack/react-query";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import { readInterviewRoundSummaries } from '@/features/interviews/api/round-summaries';
import { interviewRoundFromRow } from "../utils/interviewRoundEvents";

export function useInterviewRoundEvents(
  rangeStart?: string,
  rangeEnd?: string,
) {
  return useQuery({
    queryKey: ["interview-round-events", rangeStart, rangeEnd],
    queryFn: async () => {
      const start = rangeStart ? new Date(`${rangeStart}T00:00:00`) : null;
      const end = rangeEnd ? new Date(`${rangeEnd}T23:59:59.999`) : null;
      const client = getSupabaseClient();
      const [data, subject] = await Promise.all([
        readInterviewRoundSummaries({rangeStart,rangeEnd,scheduledOnly:true}),
        client.from('subjects').select('id').ilike('name','Medicine Interview').limit(1).maybeSingle(),
      ]);
      if (subject.error) throw subject.error;
      return (data ?? []).flatMap((row) => {
        const event = interviewRoundFromRow(row);
        if (!event) return [];
        const when = new Date(event.scheduledAt);
        return (!start || when >= start) && (!end || when <= end)
          ? [{ ...event, subjectId: subject.data?.id }]
          : [];
      });
    },
    staleTime: 30_000,
  });
}
