'use client';

import { UseFormReturn } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  Switch,
} from '@altitutor/ui';

import type { Folder, NoteFormData } from '../types';
import { FolderSearchSelect } from './FolderSearchSelect';
import { ProjectSearchSelect } from './ProjectSearchSelect';

interface NotePropertiesPanelProps {
  form: UseFormReturn<NoteFormData>;
  folders?: Folder[];
}

export function NotePropertiesPanel({ form, folders }: NotePropertiesPanelProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-foreground">Properties</h3>
      <Form {...form}>
        <div className="space-y-4">
          <FolderSearchSelect form={form} folders={folders} />
          <ProjectSearchSelect form={form} />
          <FormField
            control={form.control}
            name="is_tutor_documentation"
            render={({ field }) => (
              <FormItem className="rounded-lg bg-muted/35 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm">Tutor documentation</FormLabel>
                    <FormDescription>
                      Show this document read-only in tutor-web.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={Boolean(field.value)}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </div>
              </FormItem>
            )}
          />
        </div>
      </Form>
    </div>
  );
}
