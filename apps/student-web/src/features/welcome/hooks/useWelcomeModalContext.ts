import { useQuery } from '@tanstack/react-query';
import { welcomeApi } from '../api/welcome';

export function useWelcomeModalContext(enabled: boolean) {
  return useQuery({
    queryKey: ['student', 'welcome-modal', 'context'],
    queryFn: () => welcomeApi.getWelcomeModalContext(),
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}
