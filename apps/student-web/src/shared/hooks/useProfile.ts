import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileApi, type StudentProfileUpdate } from '@/shared/api/profile';
import { useToast } from '@altitutor/ui';

export function useProfile() {
  return useQuery({
    queryKey: ['student', 'profile'],
    queryFn: profileApi.getProfile,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (updates: StudentProfileUpdate) => profileApi.updateProfile(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', 'profile'] });
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
