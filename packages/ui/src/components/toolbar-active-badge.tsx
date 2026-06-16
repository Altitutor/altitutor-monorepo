'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/cn';

interface ToolbarActiveBadgeProps {
  children: React.ReactNode;
  onClear: () => void;
  ariaLabel: string;
  className?: string;
}

export function ToolbarActiveBadge({
  children,
  onClear,
  ariaLabel,
  className,
}: ToolbarActiveBadgeProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={cn(
        'group/badge absolute -right-1.5 -top-1.5 z-10 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-none text-primary-foreground shadow-sm ring-2 ring-background transition-colors hover:bg-destructive hover:text-destructive-foreground',
        className,
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClear();
      }}
    >
      <span className="group-hover/badge:hidden">{children}</span>
      <X className="hidden h-3 w-3 group-hover/badge:block" />
    </button>
  );
}
