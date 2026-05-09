'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, ChevronLeft } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { studentCardCn } from '@/shared/lib/student-visual';

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
    studentCardCn('group block min-w-0 p-3'),
    'hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] focus-within:-translate-y-0.5 focus-within:shadow-[0_12px_40px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_12px_40px_rgb(0,0,0,0.32)] dark:focus-within:shadow-[0_12px_40px_rgb(0,0,0,0.32)]',
  );

  const labelClass =
    'mt-1 block break-words text-xs font-medium leading-snug tracking-tight transition-colors duration-300 group-hover:text-brand-darkBlue dark:group-hover:text-brand-lightBlue';
  const eyebrowClass = 'flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';

  return (
    <nav aria-label={ariaLabel} className="flex gap-3">
      {prev ? (
        <Link href={prev.href} className={cn(cardClass, 'flex-1')}>
          <div className={eyebrowClass}>
            <ArrowLeft className="h-3 w-3 shrink-0 transition-transform duration-300 ease-out group-hover:-translate-x-0.5 group-hover:text-foreground" />
            <span>Previous</span>
          </div>
          <span className={labelClass}>{prev.label}</span>
        </Link>
      ) : null}

      {next ? (
        <Link href={next.href} className={cn(cardClass, 'flex-1 text-right')}>
          <div className={cn(eyebrowClass, 'justify-end')}>
            <span>Next</span>
            <ArrowRight className="h-3 w-3 shrink-0 transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:text-foreground" />
          </div>
          <span className={labelClass}>{next.label}</span>
        </Link>
      ) : null}
    </nav>
  );
}
