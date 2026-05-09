import { useQuery } from '@tanstack/react-query';
import { fetchMyBillingSubsidies } from '../api/subsidies';
import { useAuthStore } from '@/shared/lib/supabase/auth';

export function useMyBillingSubsidies() {
  const { user, loading: authLoading } = useAuthStore();

  return useQuery({
    queryKey: ['billing', 'my-subsidies'],
    queryFn: fetchMyBillingSubsidies,
    enabled: !authLoading && !!user,
    refetchOnWindowFocus: false,
  });
}
