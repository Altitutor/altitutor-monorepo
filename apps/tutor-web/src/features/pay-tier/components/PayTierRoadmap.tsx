'use client';

import { useEffect, useState } from 'react';
import { Loader2, Check, Lock } from 'lucide-react';
import { Badge } from '@altitutor/ui';
import { formatPayRate, type StaffTierProgress } from '@altitutor/shared/pay-tiers';
import { TUTOR_CONTENT_MAX, TUTOR_SHELL_PAD_X } from '@/shared/lib/tutor-layout';
import { cn } from '@/shared/utils';

export function PayTierRoadmap() {
  const [progress, setProgress] = useState<StaffTierProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/pay-tier');
        const json = (await res.json()) as { progress?: StaffTierProgress; error?: string };
        if (!res.ok) throw new Error(json.error ?? 'Failed to load');
        setProgress(json.progress ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !progress) {
    return (
      <div className={cn(TUTOR_SHELL_PAD_X, TUTOR_CONTENT_MAX, 'mx-auto py-8')}>
        <p className="text-destructive">{error ?? 'Unable to load pay tier'}</p>
      </div>
    );
  }

  const currentTier = progress.tiers.find((t) => t.tier_number === progress.currentTierNumber);

  return (
    <div className={cn(TUTOR_SHELL_PAD_X, TUTOR_CONTENT_MAX, 'mx-auto py-8 space-y-8')}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My pay tier</h1>
        <p className="text-muted-foreground mt-1">
          Your progression on the Altitutor pay ladder. Promotions follow a check-in review with admin.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">Current tier</p>
        <p className="text-2xl font-semibold mt-1">
          Tier {progress.currentTierNumber}
          {currentTier?.name ? ` — ${currentTier.name}` : ''}
        </p>
        {currentTier && (
          <p className="text-muted-foreground mt-1">
            Base rate: {formatPayRate(currentTier.base_pay_rate_cents, currentTier.currency)}/hr
          </p>
        )}
        {progress.isEligibleForReview && (
          <Badge className="mt-3">You&apos;re eligible for a tier review check-in</Badge>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Roadmap</h2>
        <div className="space-y-3">
          {progress.tiers.map((tier) => {
            const state =
              tier.tier_number < progress.currentTierNumber
                ? 'completed'
                : tier.tier_number === progress.currentTierNumber
                  ? 'current'
                  : 'upcoming';
            return (
              <div
                key={tier.tier_number}
                className={cn(
                  'flex items-center gap-4 rounded-xl border p-4',
                  state === 'current' && 'border-primary bg-primary/5',
                  state === 'upcoming' && 'opacity-60'
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                    state === 'completed' && 'bg-primary text-primary-foreground',
                    state === 'current' && 'bg-primary text-primary-foreground',
                    state === 'upcoming' && 'bg-muted'
                  )}
                >
                  {state === 'completed' ? (
                    <Check className="h-5 w-5" />
                  ) : state === 'upcoming' ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-bold">{tier.tier_number}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">
                    Tier {tier.tier_number}
                    {tier.name ? ` — ${tier.name}` : ''}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatPayRate(tier.base_pay_rate_cents, tier.currency)}/hr base rate
                  </p>
                </div>
                {state === 'current' && (
                  <Badge variant="secondary">You are here</Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {progress.nextTierNumber && progress.requirementsForNextTier.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Requirements for tier {progress.nextTierNumber}</h2>
          <ul className="space-y-3">
            {progress.requirementsForNextTier.map((r) => (
              <li key={r.id} className="rounded-xl border p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>{r.label}</span>
                  <span className={r.met ? 'text-primary font-medium' : 'text-muted-foreground'}>
                    {r.current} / {r.required}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(100, r.required > 0 ? (r.current / r.required) * 100 : 0)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {progress.promotions.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Review history</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            {progress.promotions.map((p) => (
              <li key={p.id}>
                {new Date(p.reviewed_at).toLocaleDateString('en-AU', { dateStyle: 'medium' })}:{' '}
                {p.outcome.replace('_', ' ')}
                {p.from_tier_number !== p.to_tier_number
                  ? ` — now tier ${p.to_tier_number}`
                  : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
