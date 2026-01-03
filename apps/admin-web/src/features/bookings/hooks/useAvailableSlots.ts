import { useQuery } from '@tanstack/react-query';
import { availabilityApi, type GetAvailableSlotsParams } from '../api/availability';

export function useAvailableSlots(params: GetAvailableSlotsParams, enabled: boolean = true) {
  // Use individual values in query key instead of object to ensure stability
  // This prevents React Query from treating it as a new query when object reference changes
  const queryKey = [
    'available-slots',
    params.start_date,
    params.end_date,
    params.session_type,
    params.subject_id,
    params.duration_minutes,
  ];
  
  return useQuery({
    queryKey: queryKey,
    queryFn: () => availabilityApi.getAvailableSlots(params),
    enabled: enabled && !!params.start_date && !!params.end_date && !!params.session_type,
    staleTime: 30 * 1000, // 30 seconds - availability changes frequently
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

