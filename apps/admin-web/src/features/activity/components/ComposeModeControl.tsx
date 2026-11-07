'use client';

import { SegmentedControl } from '@altitutor/ui';

export type ComposeMode = 'message' | 'note';
type FormComposeMode = ComposeMode | 'form';

export function ComposeModeControl({
  value,
  onValueChange,
  allowForm,
}: { value: ComposeMode; onValueChange: (value: ComposeMode) => void; allowForm?: false }
  | { value: FormComposeMode; onValueChange: (value: FormComposeMode) => void; allowForm: true }) {
  return (
    <SegmentedControl
      size="sm"
      aria-label="Composer mode"
      value={value}
      onValueChange={(value) => {
        if (value === 'form') {
          if (allowForm) onValueChange(value);
        } else {
          onValueChange(value);
        }
      }}
      options={[
        { value: 'message', label: 'Message' },
        { value: 'note', label: 'Note' },
        ...(allowForm ? [{ value: 'form' as const, label: 'Form' }] : []),
      ]}
      className="shrink-0"
    />
  );
}
