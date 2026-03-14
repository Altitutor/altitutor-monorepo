'use client';

import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';

/** Normalise ISO or YYYY-MM-DD to YYYY-MM-DD for input[type=date] */
function toInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

export interface DatePickerPopoverProps {
  /** Trigger element (receives ref + onClick from PopoverTrigger asChild) */
  children: React.ReactElement;
  /** Current value: ISO date string or YYYY-MM-DD */
  value: string | null;
  /** Called when user selects a date; popover closes after */
  onChange: (value: string | null) => void;
  onBlur?: () => void;
  name?: string;
  modal?: boolean;
  align?: 'start' | 'center' | 'end';
  /** Stop propagation on content click (e.g. when inside entity list row) */
  stopPropagation?: boolean;
}

/**
 * Standard date picker: Popover with trigger + input[type=date] in content.
 * Closes on outside click and when a date is selected. Use inside dialogs with modal={false}.
 */
export function DatePickerPopover({
  children,
  value,
  onChange,
  onBlur,
  name,
  modal = false,
  align = 'start',
  stopPropagation = false,
}: DatePickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const inputValue = toInputValue(value);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={modal}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-auto p-2"
        align={align}
        onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      >
        <input
          type="date"
          name={name}
          onBlur={onBlur}
          value={inputValue}
          onChange={(e) => {
            const val = e.target.value || null;
            onChange(val ? new Date(val).toISOString() : null);
            setOpen(false);
          }}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        />
      </PopoverContent>
    </Popover>
  );
}
