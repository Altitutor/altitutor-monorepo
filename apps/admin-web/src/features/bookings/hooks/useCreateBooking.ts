import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsApi, type CreateBookingInput } from '../api/bookings';
import { sessionsKeys } from '@/features/sessions/hooks/useSessionsQuery';

export function useCreateBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (input: CreateBookingInput) => bookingsApi.createBooking(input),
    onSuccess: (_sessionId) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: sessionsKeys.all });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

