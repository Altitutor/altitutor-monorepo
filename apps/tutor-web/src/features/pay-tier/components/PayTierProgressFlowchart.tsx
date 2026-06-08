'use client';

import { ArrowRight, CheckCircle2, ClipboardCheck, MessageSquare, Repeat, TrendingUp } from 'lucide-react';
import { tutorCardCn } from '@/shared/lib/tutor-visual';
import { cn } from '@/shared/utils';

const STEPS = [
  {
    icon: TrendingUp,
    title: 'Start at your tier',
    description: 'Everyone begins at tier 1 and works through the pay ladder step by step.',
  },
  {
    icon: CheckCircle2,
    title: 'Complete requirements',
    description: 'Meet every requirement for your current tier — sessions, tenure, and time since your last promotion.',
  },
  {
    icon: ClipboardCheck,
    title: 'Request a check-in',
    description: 'Once eligible, ask us to book a check-in so your progress can be reviewed.',
  },
  {
    icon: MessageSquare,
    title: 'Receive feedback',
    description: 'During the check-in we share feedback gathered from students and staff about your teaching.',
  },
  {
    icon: ArrowRight,
    title: 'Progress up a tier',
    description: 'If the feedback is strong, you will be promoted to the next pay tier.',
  },
  {
    icon: Repeat,
    title: 'Repeat',
    description: 'Work toward the next tier’s requirements and request another check-in when ready.',
  },
] as const;

export function PayTierProgressFlowchart() {
  return (
    <section
      aria-labelledby="pay-tier-how-it-works"
      className={cn(tutorCardCn('p-5 sm:p-6'), 'space-y-5')}
    >
      <div>
        <h2 id="pay-tier-how-it-works" className="text-lg font-semibold tracking-tight">
          How pay tiers work
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A quick overview of how you move up the pay ladder.
        </p>
      </div>

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          return (
            <li
              key={step.title}
              className="relative flex gap-3 rounded-xl border border-black/[0.06] bg-background/60 p-4 dark:border-white/10"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Step {index + 1}
                </p>
                <p className="text-sm font-semibold leading-snug">{step.title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
