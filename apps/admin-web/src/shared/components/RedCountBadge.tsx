'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import { cn } from '@/shared/utils';

export function RedCountBadge({ count, tooltip, className }: { count: number | string; tooltip: string; className?: string }) {
  if (Number(count) === 0) return null;

  return <TooltipProvider delayDuration={0}><Tooltip>
    <TooltipTrigger asChild>
      <span tabIndex={0} aria-label={tooltip} className={cn('shrink-0 rounded-full bg-red-500 px-1.5 text-xs font-bold tabular-nums text-white', className)}>{count}</span>
    </TooltipTrigger>
    <TooltipContent className="max-w-sm whitespace-pre-line">{tooltip}</TooltipContent>
  </Tooltip></TooltipProvider>;
}
