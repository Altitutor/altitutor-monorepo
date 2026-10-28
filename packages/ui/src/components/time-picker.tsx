'use client';

import * as React from 'react';
import { Clock } from 'lucide-react';
import { SearchableSelect } from './searchable-select';
import { SearchableSelectFieldTrigger } from './searchable-select-field-trigger';
import { timeLabel, timeOptions } from '../lib/time-picker';

export interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

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
      trigger={<SearchableSelectFieldTrigger id={id} disabled={disabled} className={className} aria-label={ariaLabel}>
        <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
        {value ? timeLabel(value) : 'Select time'}
      </SearchableSelectFieldTrigger>}
    />
  );
}
