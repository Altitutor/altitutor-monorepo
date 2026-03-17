'use client';

import { UseFormReturn } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem } from '@altitutor/ui';
import { SearchableSelect } from '@altitutor/ui';

import type { NoteFormData } from '../types';
import { ProjectSearchSelect } from './ProjectSearchSelect';

interface NotePropertiesPanelProps {
  form: UseFormReturn<NoteFormData>;
  folders?: Array<{ id: string; name: string }>;
}

export function NotePropertiesPanel({ form, folders }: NotePropertiesPanelProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-foreground">Properties</h3>
      <Form {...form}>
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="folder_id"
            render={({ field }) => {
              const folderItems = folders ?? [];
              const selected = field.value
                ? folderItems.find((f) => f.id === field.value) ?? null
                : null;
              return (
                <FormItem>
                  <FormControl>
                    <SearchableSelect<{ id: string; name: string }>
                      items={folderItems}
                      value={selected}
                      onValueChange={(item) => field.onChange(item?.id ?? null)}
                      getItemLabel={(f) => f.name}
                      getItemId={(f) => f.id}
                      placeholder="No folder"
                      allowClear
                      clearLabel="None"
                    />
                  </FormControl>
                </FormItem>
              );
            }}
          />
          <ProjectSearchSelect form={form} />
        </div>
      </Form>
    </div>
  );
}
