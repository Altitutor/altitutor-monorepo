import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationsApi, type CreateReservationInput } from '../api/reservations';
import { useAuthStore } from '@/shared/lib/supabase/auth';

export function useMyReservations() {
  const { user } = useAuthStore();
  const isAuthenticated = !!user;
  
  return useQuery({
    queryKey: ['reservations', 'my'],
    queryFn: () => reservationsApi.getMyReservations(),
    enabled: isAuthenticated, // Only fetch if authenticated
    staleTime: 10 * 1000, // 10 seconds - reservations expire quickly
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (input: CreateReservationInput) => reservationsApi.createReservation(input),
    onSuccess: () => {
      // Invalidate availability queries to reflect reservation
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}

export function useDeleteReservation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => reservationsApi.deleteReservation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}

