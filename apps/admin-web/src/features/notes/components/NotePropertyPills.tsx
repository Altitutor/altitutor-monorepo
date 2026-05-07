'use client';

import { UseFormReturn } from 'react-hook-form';

import type { NoteFormData } from '../types';
import { FolderSearchSelect } from './FolderSearchSelect';
import { ProjectSearchSelect } from './ProjectSearchSelect';

interface NotePropertyPillsProps {
  form: UseFormReturn<NoteFormData>;
  folders?: Array<{ id: string; name: string }>;
}

export function NotePropertyPills({ form, folders }: NotePropertyPillsProps) {
  return (
    <div className="flex flex-wrap gap-2 pb-2">
      <FolderSearchSelect form={form} folders={folders} variant="pill" />
      <ProjectSearchSelect form={form} variant="pill" />
    </div>
  );
}
