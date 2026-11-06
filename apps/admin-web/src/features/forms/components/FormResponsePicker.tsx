'use client';

import { useState } from 'react';
import { SearchableSelect } from '@altitutor/ui';
import { useFormResponseOptions, type FormRespondent } from '../api/formResponseOptions';
import { FillFormDialog } from './FillFormDialog';

export function FormResponsePicker({ respondent, onSaved }: {
  respondent: FormRespondent;
  onSaved: () => void;
}) {
  const [formId, setFormId] = useState<string | null>(null);
  const options = useFormResponseOptions();

  return (
    <>
      <SearchableSelect
        items={options.data?.forms ?? []}
        value={null}
        onValueChange={(form) => setFormId(form?.id ?? null)}
        getItemId={(form) => form.id}
        getItemLabel={(form) => form.name}
        loading={options.isLoading}
        placeholder="Select form"
        searchPlaceholder="Search published forms..."
        emptyMessage={options.error?.message ?? 'No published forms found.'}
        contentWidth="min(420px, calc(100vw - 2rem))"
      />
      {formId && (
        <FillFormDialog
          open
          onClose={() => setFormId(null)}
          lockedFormId={formId}
          lockedRespondent={respondent}
          onSaved={onSaved}
        />
      )}
    </>
  );
}
