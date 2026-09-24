'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ClickableCardIcon } from '@altitutor/ui';
import { clickableCardFocusRingCn, clickableCardHoverCn, cn } from '@/shared/utils';

export function AdminSettingsCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex h-full w-full flex-col rounded-lg border bg-card p-5 text-left transition-colors hover:bg-muted/40',
        clickableCardHoverCn,
        clickableCardFocusRingCn,
      )}
    >
      <div className="flex w-full items-start justify-between gap-4">
        <ClickableCardIcon icon={icon} size="sm" />
      </div>
      <h3 className="mt-4 text-base font-semibold leading-tight">{title}</h3>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
    </Link>
  );
}
