'use client';

import { useState } from 'react';
import { Badge } from '@altitutor/ui';
import { Check, ChevronDown, Lock } from 'lucide-react';
import {
  formatPayRate,
  formatPayTierTierStatus,
  type StaffTierProgress,
} from '@altitutor/shared/pay-tiers';
import { cn } from '@/shared/utils';

export function PayTiersStaffTierCards({ progress }: { progress: StaffTierProgress }) {
  const [expandedTier, setExpandedTier] = useState<number>(progress.currentTierNumber);

  const toggleTier = (tierNumber: number) => {
    setExpandedTier((prev) => (prev === tierNumber ? -1 : tierNumber));
  };

  return (
    <div className="space-y-3">
      {progress.isEligibleForReview && (
        <Badge>Eligible for tier review check-in</Badge>
      )}

      <ul className="space-y-3">
        {progress.tierDetails.map((detail) => {
          const { tier, status, requirementsToAdvance } = detail;
          const isExpanded = expandedTier === tier.tier_number;
          const isTopTier =
            tier.tier_number === progress.tiers[progress.tiers.length - 1]?.tier_number;

          return (
            <li key={tier.tier_number}>
              <div
                className={cn(
                  'rounded-lg border bg-card overflow-hidden',
                  status === 'current' && 'ring-2 ring-primary/40',
                  status === 'locked' && 'opacity-80',
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleTier(tier.tier_number)}
                  className="flex w-full items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
                  aria-expanded={isExpanded}
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                      (status === 'completed' || status === 'current') &&
                        'bg-primary text-primary-foreground',
                      status === 'locked' && 'bg-muted text-muted-foreground',
                    )}
                  >
                    {status === 'completed' ? (
                      <Check className="h-5 w-5" aria-hidden />
                    ) : status === 'locked' ? (
                      <Lock className="h-4 w-4" aria-hidden />
                    ) : (
                      <span className="text-sm font-bold">{tier.tier_number}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      Tier {tier.tier_number}
                      {tier.name ? ` — ${tier.name}` : ''}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatPayRate(tier.base_pay_rate_cents, tier.currency)}/hr base rate
                    </p>
                  </div>

                  <Badge variant={status === 'current' ? 'default' : 'secondary'} className="shrink-0">
                    {formatPayTierTierStatus(status)}
                  </Badge>

                  <ChevronDown
                    className={cn(
                      'h-5 w-5 shrink-0 text-muted-foreground transition-transform',
                      isExpanded && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </button>

                {isExpanded && (
                  <div className="border-t px-4 pb-4 pt-3">
                    {isTopTier ? (
                      <p className="text-sm text-muted-foreground">
                        Top tier on the ladder.
                      </p>
                    ) : requirementsToAdvance.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No requirements configured for this tier yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm font-medium">
                          {status === 'completed'
                            ? 'Requirements completed at this tier'
                            : status === 'current'
                              ? `Requirements to reach tier ${tier.tier_number + 1}`
                              : `Requirements to unlock tier ${tier.tier_number}`}
                        </p>
                        <ul className="space-y-3">
                          {requirementsToAdvance.map((r) => (
                            <li key={r.id}>
                              <div className="mb-2 flex justify-between text-sm">
                                <span>{r.label}</span>
                                <span
                                  className={cn(
                                    r.met ? 'font-medium text-primary' : 'text-muted-foreground',
                                  )}
                                >
                                  {r.current} / {r.required}
                                </span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full bg-primary transition-all"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      r.required > 0 ? (r.current / r.required) * 100 : 0,
                                    )}%`,
                                  }}
                                />
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
