import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsApi, type CreateBookingInput } from '../api/bookings';

export function useCreateBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (input: CreateBookingInput) => bookingsApi.createBooking(input),
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

