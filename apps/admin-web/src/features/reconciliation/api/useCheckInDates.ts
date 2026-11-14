import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { reconciliationKeys } from './queryKeys';
import { loadCheckInDates, type CheckInEntity } from './checkInDates';

export function useCheckInDates(kind: CheckInEntity, enabled: boolean) {
  return useQuery({
    queryKey: [...reconciliationKeys.familyCheckIns(), kind],
    queryFn: () => loadCheckInDates(getSupabaseClient(), kind),
    enabled,
    staleTime: 60_000,
  });
}
