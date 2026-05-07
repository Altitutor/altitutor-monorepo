'use client';

import { UseFormReturn } from 'react-hook-form';
import { Form } from '@altitutor/ui';

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
        </div>
      </Form>
    </div>
  );
}
