import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileApi, type StaffProfileUpdate } from '../api';
import { useToast } from '@altitutor/ui';

export function useProfile() {
  return useQuery({
    queryKey: ['admin', 'profile'],
    queryFn: profileApi.getProfile,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (updates: StaffProfileUpdate) => profileApi.updateProfile(updates),
    onSuccess: () => {
      // Invalidate and refetch profile
      queryClient.invalidateQueries({ queryKey: ['admin', 'profile'] });
      // Also invalidate current staff query
      queryClient.invalidateQueries({ queryKey: ['staff', 'current'] });
      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    },
  });
}


