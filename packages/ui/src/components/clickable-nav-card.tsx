'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';
import {
  clickableCardFocusRingCn,
  clickableCardHoverCn,
} from '../lib/clickable-card-styles';
import { ClickableCardIcon } from './clickable-card-icon';
import { ClickableCardRevealChevron } from './clickable-card-reveal-chevron';

type ClickableNavCardProps = {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
  cardClassName?: string;
};

export function ClickableNavCard({
  href,
  icon,
  title,
  description,
  className,
  cardClassName,
}: ClickableNavCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex h-full w-full flex-col items-start p-6 text-left',
        cardClassName,
        clickableCardHoverCn,
        clickableCardFocusRingCn,
        className,
      )}
    >
      <div className="flex w-full items-start justify-between">
        <ClickableCardIcon icon={icon} />
        <ClickableCardRevealChevron />
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
