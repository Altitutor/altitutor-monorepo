import { useQuery } from '@tanstack/react-query';

export interface PublicLinkResult {
  token: string;
  url: string;
}

export function usePublicLink(
  purpose: 'registration' | 'booking',
  id: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['public-link', purpose, id],
    queryFn: async (): Promise<PublicLinkResult> => {
      const response = await fetch('/api/public-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose, id }),
      });
      const result = (await response.json()) as PublicLinkResult & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Failed to load public link');
      return result;
    },
    enabled: enabled && !!id,
    staleTime: Infinity,
  });
}
