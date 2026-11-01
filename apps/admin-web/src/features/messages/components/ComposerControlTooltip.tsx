'use client';

import { useState, type ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@altitutor/ui';

export function ComposerControlTooltip({ label, compact, children }: { label: string; compact: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={150}><Tooltip open={compact && open} onOpenChange={setOpen}>
      <TooltipTrigger asChild><span className="inline-flex shrink-0">{children}</span></TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip></TooltipProvider>
  );
}
