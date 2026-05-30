import { useQuery } from '@tanstack/react-query';
import type { StaffTierProgress } from '@altitutor/shared/pay-tiers';

async function fetchPayTierProgress(): Promise<StaffTierProgress> {
  const res = await fetch('/api/pay-tier');
  const json = (await res.json()) as { progress?: StaffTierProgress; error?: string };
  if (!res.ok) throw new Error(json.error ?? 'Failed to load pay tier');
  if (!json.progress) throw new Error('Failed to load pay tier');
  return json.progress;
}

export const payTierKeys = {
  all: ['pay-tier'] as const,
  progress: () => [...payTierKeys.all, 'progress'] as const,
};

export function usePayTierProgress() {
  return useQuery({
    queryKey: payTierKeys.progress(),
    queryFn: fetchPayTierProgress,
    staleTime: 60_000,
  });
}
