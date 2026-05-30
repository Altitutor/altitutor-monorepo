'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
} from '@altitutor/ui';
import { Check, Lock } from 'lucide-react';
import {
  formatPayRate,
  formatPayTierTierStatus,
  type PayTierTierDetail,
  type PayTierTierStatus,
  type StaffTierProgress,
} from '@altitutor/shared/pay-tiers';
import { tutorCardCn } from '@/shared/lib/tutor-visual';
import { cn } from '@/shared/utils';

type PayTierTierCardsProps = {
  progress: StaffTierProgress;
};

function tierStatusBadgeClass(status: PayTierTierStatus): string {
  switch (status) {
    case 'completed':
      return 'shrink-0 border-transparent bg-muted text-muted-foreground';
    case 'current':
      return 'mr-2 shrink-0';
    case 'locked':
      return 'mr-2 shrink-0 border-muted-foreground/25 bg-muted/50 font-normal text-muted-foreground';
  }
}

function TierRequirementsBody({
  detail,
  progress,
  isTopTier,
}: {
  detail: PayTierTierDetail;
  progress: StaffTierProgress;
  isTopTier: boolean;
}) {
  const { tier, status, requirementsToAdvance } = detail;
  const showEligibleMessage =
    status === 'current' && progress.isEligibleForReview && progress.nextTierNumber != null;

  if (isTopTier) {
    return (
      <p className="text-sm text-muted-foreground">
        More tiers will be added as staff reach the highest tier.
      </p>
    );
  }

  if (requirementsToAdvance.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No requirements configured for this tier yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      {showEligibleMessage && (
        <div
          className={cn(
            tutorCardCn('p-4'),
            'bg-primary/5 ring-2 ring-primary/20 dark:bg-primary/10',
          )}
          role="status"
        >
          <p className="text-sm leading-relaxed text-foreground">
            You have met the requirements for this tier. Request a check-in to review your
            performance and feedback to progress to the next one.
          </p>
        </div>
      )}

      <p className="text-sm font-medium">
        {status === 'completed'
          ? 'Requirements you completed at this tier'
          : status === 'current'
            ? `Requirements to reach tier ${tier.tier_number + 1}`
            : `Requirements to unlock tier ${tier.tier_number}`}
      </p>
      <ul className="space-y-3">
        {requirementsToAdvance.map((r) => (
          <li key={r.id}>
            <div className="mb-2 flex justify-between text-sm">
              <span>{r.label}</span>
              <span className={cn(r.met ? 'font-medium text-primary' : 'text-muted-foreground')}>
                {r.current} / {r.required}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{
                  width: `${Math.min(100, r.required > 0 ? (r.current / r.required) * 100 : 0)}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PayTierTierCards({ progress }: PayTierTierCardsProps) {
  const maxTierNumber = progress.tiers[progress.tiers.length - 1]?.tier_number;

  return (
    <section aria-labelledby="pay-tiers-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="pay-tiers-heading" className="text-2xl font-semibold">
          Pay tiers
        </h2>
        {progress.isEligibleForReview && (
          <Badge variant="secondary">Ready for tier review check-in</Badge>
        )}
      </div>

      <Accordion
        type="single"
        collapsible
        defaultValue={String(progress.currentTierNumber)}
        className="space-y-3"
      >
        {progress.tierDetails.map((detail) => {
          const { tier, status } = detail;
          const isTopTier = tier.tier_number === maxTierNumber;

          return (
            <AccordionItem
              key={tier.tier_number}
              value={String(tier.tier_number)}
              className="border-0"
            >
              <div
                className={cn(
                  tutorCardCn('overflow-hidden'),
                  status === 'current' && 'bg-primary/5 ring-2 ring-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]',
                  status === 'completed' && 'opacity-95',
                  status === 'locked' && 'opacity-55',
                )}
              >
                <AccordionTrigger
                  className={cn(
                    'flex gap-4 px-5 py-5 hover:no-underline',
                    '[&>svg]:ml-0 [&>svg]:text-muted-foreground',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                      status === 'completed' && 'bg-muted text-muted-foreground',
                      status === 'current' && 'bg-primary text-primary-foreground shadow-sm',
                      status === 'locked' && 'bg-muted/80 text-muted-foreground',
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

                  <div className="min-w-0 flex-1 text-left">
                    <p
                      className={cn(
                        'font-semibold tracking-tight',
                        status === 'locked' && 'text-muted-foreground',
                        status === 'completed' && 'text-foreground/80',
                      )}
                    >
                      Tier {tier.tier_number}
                      {tier.name ? ` — ${tier.name}` : ''}
                    </p>
                    <p className="text-sm font-normal text-muted-foreground">
                      {formatPayRate(tier.base_pay_rate_cents, tier.currency)}/hr base rate
                    </p>
                  </div>

                  <Badge
                    variant={status === 'current' ? 'default' : 'outline'}
                    className={tierStatusBadgeClass(status)}
                  >
                    {formatPayTierTierStatus(status)}
                  </Badge>
                </AccordionTrigger>

                <AccordionContent className="border-t border-black/[0.06] px-5 pb-5 pt-0 dark:border-white/10">
                  <div className="pt-4">
                    <TierRequirementsBody
                      detail={detail}
                      progress={progress}
                      isTopTier={isTopTier}
                    />
                  </div>
                </AccordionContent>
              </div>
            </AccordionItem>
          );
        })}
      </Accordion>
    </section>
  );
}
