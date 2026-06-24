'use client';

import Link from 'next/link';
import { Button } from '@altitutor/ui';
import { ChevronLeft } from 'lucide-react';
import { studentBtnIconOutline } from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';

type SettingsPageHeaderProps = {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
};

export function SettingsPageHeader({
  title,
  description,
  backHref,
  backLabel,
}: SettingsPageHeaderProps) {
  return (
    <div className="flex items-start gap-3">
      {backHref ? (
        <Button
          variant="outline"
          size="icon"
          asChild
          className={cn(studentBtnIconOutline, 'group shrink-0 [&_svg]:size-5')}
        >
          <Link href={backHref} aria-label={backLabel ?? 'Go back'}>
            <ChevronLeft className="h-5 w-5 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" />
          </Link>
        </Button>
      ) : null}
      <div className="min-w-0 flex-1">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
