'use client';

import { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem } from '@altitutor/ui';
import { SearchableSelect } from '@altitutor/ui';

import type { NoteFormData } from '../types';
import { ProjectSearchSelect } from './ProjectSearchSelect';

interface NotePropertyPillsProps {
  form: UseFormReturn<NoteFormData>;
  folders?: Array<{ id: string; name: string }>;
}

export function NotePropertyPills({ form, folders }: NotePropertyPillsProps) {
  return (
    <div className="flex flex-wrap gap-2 pb-2">
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
                  clearLabel="No Folder"
                  triggerClassName="h-8 px-3 text-xs border rounded-full"
                />
              </FormControl>
            </FormItem>
          );
        }}
      />
      <ProjectSearchSelect form={form} variant="pill" />
    </div>
  );
}
