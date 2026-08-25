'use client';

import {
  Button,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  SearchableSelect,
} from '@altitutor/ui';
import { Eye } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils';
import type { NoteFormData } from '../types';

const PROPERTIES_GRID_CLASS = 'grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 space-y-0';

const TUTOR_VISIBILITY_OPTIONS = [
  { value: false, label: 'Not visible' },
  { value: true, label: 'Visible' },
] as const;

type TutorVisibilityOption = (typeof TUTOR_VISIBILITY_OPTIONS)[number];

interface TutorDocumentationSelectProps {
  form: UseFormReturn<NoteFormData>;
  editable?: boolean;
  onDisabledInteract?: () => void;
}

export function TutorDocumentationSelect({
  form,
  editable = true,
  onDisabledInteract,
}: TutorDocumentationSelectProps) {
  return (
    <FormField
      control={form.control}
      name="is_tutor_documentation"
      render={({ field }) => {
        const selected =
          TUTOR_VISIBILITY_OPTIONS.find((option) => option.value === Boolean(field.value)) ??
          TUTOR_VISIBILITY_OPTIONS[0];

        return (
          <FormItem className={PROPERTIES_GRID_CLASS}>
            <FormLabel className="text-muted-foreground">Tutor visibility</FormLabel>
            <FormControl>
              <SearchableSelect<TutorVisibilityOption>
                items={[...TUTOR_VISIBILITY_OPTIONS]}
                value={selected}
                disabled={!editable}
                onValueChange={(option) => field.onChange(option?.value ?? false)}
                getItemId={(option) => String(option.value)}
                getItemLabel={(option) => option.label}
                fullWidth
                trigger={
                  <Button
                    type="button"
                    variant="field"
                    disabled={!editable}
                    className="w-full justify-start"
                    onPointerDown={(event) => {
                      if (!editable) {
                        event.preventDefault();
                        onDisabledInteract?.();
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 w-full min-w-0">
                      <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className={cn('truncate', !field.value && 'text-muted-foreground')}>
                        {selected.label}
                      </span>
                    </div>
                  </Button>
                }
              />
            </FormControl>
            <FormMessage className="col-start-2" />
          </FormItem>
        );
      }}
    />
  );
}
