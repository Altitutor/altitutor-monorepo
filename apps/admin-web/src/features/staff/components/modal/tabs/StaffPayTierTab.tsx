'use client';

import Link from 'next/link';
import { Loader2, ExternalLink } from 'lucide-react';
import { Button, Badge } from '@altitutor/ui';
import { formatPayRate } from '@altitutor/shared/pay-tiers';
import { usePayTierStaffProgress } from '@/features/pay-tiers/hooks';

export function StaffPayTierTab({ staffId }: { staffId: string }) {
  const { data: progress, isLoading, isError, error } = usePayTierStaffProgress(staffId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (isError || !progress) {
    return (
      <p className="text-sm text-destructive py-4">
        {error instanceof Error ? error.message : 'Failed to load pay tier'}
      </p>
    );
  }

  const currentTier = progress.tiers.find((t) => t.tier_number === progress.currentTierNumber);

  return (
    <div className="space-y-4 py-2">
      <div>
        <p className="text-sm text-muted-foreground">Current tier</p>
        <p className="text-lg font-semibold">
          Tier {progress.currentTierNumber}
          {currentTier?.name ? ` — ${currentTier.name}` : ''}
        </p>
        {currentTier && (
          <p className="text-sm text-muted-foreground">
            {formatPayRate(currentTier.base_pay_rate_cents, currentTier.currency)}/hr
          </p>
        )}
        {progress.isEligibleForReview && (
          <Badge className="mt-2">Eligible for tier review</Badge>
        )}
      </div>

      {progress.nextTierNumber && progress.requirementsForNextTier.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Progress toward tier {progress.nextTierNumber}</p>
          <ul className="space-y-2 text-sm">
            {progress.requirementsForNextTier.map((r) => (
              <li key={r.id} className="flex justify-between rounded border p-2">
                <span>{r.label}</span>
                <span className={r.met ? 'text-green-600' : 'text-muted-foreground'}>
                  {r.current} / {r.required}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button variant="outline" size="sm" asChild>
        <Link href="/pay-tiers">
          Manage in Pay tiers
          <ExternalLink className="ml-2 h-3 w-3" />
        </Link>
      </Button>
    </div>
  );
}
