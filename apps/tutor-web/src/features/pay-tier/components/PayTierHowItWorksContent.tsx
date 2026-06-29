'use client';

import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  MessageSquare,
  Repeat,
  TrendingUp,
} from 'lucide-react';
import { ClickableCardIcon } from '@altitutor/ui';
import { tutorCardCn, tutorClickableCardHoverCn } from '@/shared/lib/tutor-visual';
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

export function PayTierHowItWorksContent() {
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        return (
          <li
            key={step.title}
            className={cn(
              tutorCardCn('group flex h-full flex-col p-5'),
              tutorClickableCardHoverCn,
            )}
          >
            <div className="flex w-full items-start justify-between gap-3">
              <ClickableCardIcon icon={Icon} size="sm" />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Step {index + 1}
              </span>
            </div>
            <h3 className="mt-4 font-semibold leading-snug tracking-tight">{step.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
          </li>
        );
      })}
    </ol>
  );
}
