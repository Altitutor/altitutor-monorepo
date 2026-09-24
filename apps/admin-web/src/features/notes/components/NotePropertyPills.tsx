'use client';

import { UseFormReturn } from 'react-hook-form';

import type { Folder, NoteFormData } from '../types';
import { FolderSearchSelect } from './FolderSearchSelect';
import { ProjectSearchSelect } from './ProjectSearchSelect';

interface NotePropertyPillsProps {
  form: UseFormReturn<NoteFormData>;
  folders?: Folder[];
  editable?: boolean;
  onDisabledInteract?: () => void;
}

export function NotePropertyPills({
  form,
  folders,
  editable = true,
  onDisabledInteract,
}: NotePropertyPillsProps) {
  return (
    <div className="flex flex-wrap gap-2 pb-2">
      <FolderSearchSelect
        form={form}
        folders={folders}
        variant="pill"
        editable={editable}
        onDisabledInteract={onDisabledInteract}
      />
      <ProjectSearchSelect
        form={form}
        variant="pill"
        editable={editable}
        onDisabledInteract={onDisabledInteract}
      />
    </div>
  );
}
