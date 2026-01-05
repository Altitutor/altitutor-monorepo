import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileApi, type TutorProfileUpdate } from '../api';
import { useToast } from '@altitutor/ui';

export function useProfile() {
  return useQuery({
    queryKey: ['tutor', 'profile'],
    queryFn: profileApi.getProfile,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (updates: TutorProfileUpdate) => profileApi.updateProfile(updates),
    onSuccess: () => {
      // Invalidate and refetch profile
      queryClient.invalidateQueries({ queryKey: ['tutor', 'profile'] });
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

