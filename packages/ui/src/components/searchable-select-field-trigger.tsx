'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '../lib/cn';
import { searchableSelectChevronClassName } from '../lib/field-trigger';
import { Button, type ButtonProps } from './button';

export type SearchableSelectFieldTriggerProps = ButtonProps;

/** Field-style SearchableSelect trigger with muted hover and trailing chevron. */
export const SearchableSelectFieldTrigger = React.forwardRef<
  HTMLButtonElement,
  SearchableSelectFieldTriggerProps
>(function SearchableSelectFieldTrigger({ className, children, ...props }, ref) {
  return (
    <Button
      type="button"
      variant="field"
      className={cn('w-full justify-between font-normal', className)}
      {...props}
      ref={ref}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2 text-left">{children}</span>
      <ChevronDown className={searchableSelectChevronClassName} aria-hidden />
    </Button>
  );
});
