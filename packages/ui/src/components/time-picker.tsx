'use client';

import * as React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '../lib/cn';
import { fieldTriggerClassName } from '../lib/field-trigger';
import { SearchableSelect } from './searchable-select';
import { timeLabel, timeOptions } from '../lib/time-picker';

export interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

const TimeFieldTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(function TimeFieldTrigger({ value, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      {...props}
      type="button"
      className={cn(
        fieldTriggerClassName,
        'group justify-between',
        !value && 'text-muted-foreground',
        className,
      )}
    >
      <span className="truncate">{value ? timeLabel(value) : 'Select time'}</span>
      <Clock
        className={cn(
          'h-4 w-4 shrink-0',
          value ? 'text-foreground' : 'text-muted-foreground opacity-40 group-hover:opacity-100',
        )}
        aria-hidden
      />
    </button>
  );
});

/** Shared searchable time field; accepts exact minutes as well as quarter-hour presets. */
export function TimePicker({ value, onChange, id, disabled, className, 'aria-label': ariaLabel = 'Time' }: TimePickerProps) {
  const [query, setQuery] = React.useState('');
  return (
    <SearchableSelect
      items={timeOptions(query)}
      value={value || null}
      onValueChange={(next) => onChange(next ?? '')}
      getItemId={(item) => item}
      getItemLabel={timeLabel}
      onSearchChange={setQuery}
      searchPlaceholder="Type a time, e.g. 4, 415, or 1615"
      emptyMessage="Enter a valid time, e.g. 14:30."
      disabled={disabled}
      fullWidth
      trigger={
        <TimeFieldTrigger
          id={id}
          disabled={disabled}
          className={className}
          aria-label={ariaLabel}
          value={value}
        />
      }
    />
  );
}
