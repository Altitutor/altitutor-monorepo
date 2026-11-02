'use client';

import * as React from 'react';
import { SearchableSelect } from './searchable-select';
import { SearchableSelectFieldTrigger } from './searchable-select-field-trigger';
import { durationLabel, durationOptions } from '../lib/duration-picker';

export interface DurationPickerProps {
  value: number | null;
  onChange: (minutes: number) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** Preset lengths, plus any positive minute count typed into the search. */
export function DurationPicker({
  value,
  onChange,
  id,
  disabled,
  className,
  'aria-label': ariaLabel = 'Duration',
}: DurationPickerProps) {
  const [query, setQuery] = React.useState('');
  return (
    <SearchableSelect
      items={durationOptions(query, value)}
      value={value}
      onValueChange={(next) => {
        if (next != null) onChange(next);
      }}
      getItemId={(item) => String(item)}
      getItemLabel={durationLabel}
      onSearchChange={setQuery}
      searchPlaceholder="Type minutes, e.g. 60 or 301"
      emptyMessage="Enter a number of minutes."
      disabled={disabled}
      fullWidth
      trigger={
        <SearchableSelectFieldTrigger id={id} disabled={disabled} className={className} aria-label={ariaLabel}>
          {value != null ? durationLabel(value) : 'Select duration'}
        </SearchableSelectFieldTrigger>
      }
    />
  );
}
