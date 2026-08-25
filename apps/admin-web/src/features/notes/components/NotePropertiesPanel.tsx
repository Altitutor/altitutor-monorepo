'use client';

import { UseFormReturn } from 'react-hook-form';

import type { Folder, NoteFormData } from '../types';
import { FolderSearchSelect } from './FolderSearchSelect';
import { ProjectSearchSelect } from './ProjectSearchSelect';
import { TutorDocumentationSelect } from './TutorDocumentationSelect';

interface NotePropertiesPanelProps {
  form: UseFormReturn<NoteFormData>;
  folders?: Folder[];
  editable?: boolean;
  /** When true, omit the section heading (parent card supplies the title). */
  embedded?: boolean;
  onViewModeInteract?: () => void;
}

export function NotePropertiesPanel({
  form,
  folders,
  editable = true,
  embedded = false,
  onViewModeInteract,
}: NotePropertiesPanelProps) {
  return (
    <div className={embedded ? undefined : 'space-y-6'}>
      {!embedded ? (
        <h3 className="text-sm font-semibold text-foreground">Properties</h3>
      ) : null}
      <div className="space-y-4">
        <FolderSearchSelect
          form={form}
          folders={folders}
          variant="properties"
          editable={editable}
          onDisabledInteract={onViewModeInteract}
        />
        <ProjectSearchSelect
          form={form}
          variant="properties"
          editable={editable}
          onDisabledInteract={onViewModeInteract}
        />
        <TutorDocumentationSelect
          form={form}
          editable={editable}
          onDisabledInteract={onViewModeInteract}
        />
      </div>
    </div>
  );
}
