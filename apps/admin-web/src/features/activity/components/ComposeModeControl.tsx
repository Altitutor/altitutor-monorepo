'use client';

import { SegmentedControl } from '@altitutor/ui';

export type ComposeMode = 'message' | 'note';

export function ComposeModeControl({
  value,
  onValueChange,
}: {
  value: ComposeMode;
  onValueChange: (value: ComposeMode) => void;
}) {
  return (
    <SegmentedControl
      size="sm"
      aria-label="Composer mode"
      value={value}
      onValueChange={onValueChange}
      options={[
        { value: 'message', label: 'Message' },
        { value: 'note', label: 'Note' },
      ]}
      className="shrink-0"
    />
  );
}
