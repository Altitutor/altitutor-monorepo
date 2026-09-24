'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft } from 'lucide-react';
import { Button, ClickableCardRevealChevron, clickableCardInteractiveCn } from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { tutorBtnIconOutline, tutorCardCn } from '@/shared/lib/tutor-visual';
import { ResourcesBreadcrumb, type ResourceBreadcrumbItem } from './resources-breadcrumb';

export function ResourcesPageHeader({
  title,
  actions,
  backHref,
  backLabel,
  breadcrumbs,
}: {
  title: string;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  breadcrumbs?: ResourceBreadcrumbItem[];
}) {
  return (
    <>
      {breadcrumbs ? <ResourcesBreadcrumb items={breadcrumbs} /> : null}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {backHref ? (
            <Button asChild variant="outline" size="icon" className={cn('mt-1', tutorBtnIconOutline)}>
              <Link href={backHref} aria-label={backLabel ?? 'Back'}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </>
  );
}

export function ResourcesBackLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className={cn(
        '-ml-2 h-auto min-h-8 items-start justify-start gap-1.5 whitespace-normal py-1.5 text-left text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      <Link href={href}>
        <ChevronLeft className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="break-words">{label}</span>
      </Link>
    </Button>
  );
}

export type ResourcesPagerEntry = { href: string; label: string };

export function ResourcesPager({
  prev,
  next,
  ariaLabel,
}: {
  prev: ResourcesPagerEntry | null;
  next: ResourcesPagerEntry | null;
  ariaLabel: string;
}) {
  if (!prev && !next) return null;

  const cardClass = cn(
    tutorCardCn('group block min-w-0 p-3'),
    clickableCardInteractiveCn,
  );

  const labelClass =
    'mt-1 block break-words text-xs font-medium leading-snug tracking-tight text-card-foreground';
  const eyebrowClass = 'flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';

  return (
    <nav aria-label={ariaLabel} className="flex gap-3">
      {prev ? (
        <Link href={prev.href} className={cn(cardClass, 'flex-1')}>
          <div className={eyebrowClass}>
            <ClickableCardRevealChevron direction="left" size="sm" />
            <span>Previous</span>
          </div>
          <span className={labelClass}>{prev.label}</span>
        </Link>
      ) : null}

      {next ? (
        <Link href={next.href} className={cn(cardClass, 'flex-1 text-right')}>
          <div className={cn(eyebrowClass, 'justify-end')}>
            <span>Next</span>
            <ClickableCardRevealChevron size="sm" />
          </div>
          <span className={labelClass}>{next.label}</span>
        </Link>
      ) : null}
    </nav>
  );
}
