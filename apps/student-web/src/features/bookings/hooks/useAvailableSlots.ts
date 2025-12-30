import { useQuery } from '@tanstack/react-query';
import { availabilityApi, type GetAvailableSlotsParams } from '../api/availability';

export function useAvailableSlots(params: GetAvailableSlotsParams, enabled: boolean = true) {
  return useQuery({
    queryKey: ['available-slots', params],
    queryFn: () => availabilityApi.getAvailableSlots(params),
    enabled: enabled && !!params.start_date && !!params.end_date && !!params.session_type,
    staleTime: 30 * 1000, // 30 seconds - availability changes frequently
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

