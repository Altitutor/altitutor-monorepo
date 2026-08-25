'use client';

import type { UseFormReturn } from 'react-hook-form';
import type { Editor } from '@tiptap/react';
import type { Folder, NoteFormData } from '../types';
import { NotePropertiesPanel } from './NotePropertiesPanel';
import { NoteTableOfContents } from './NoteTableOfContents';
import { EntitySidebarCard, EntitySidebarCards } from '@/shared/components/EntitySidebarCard';

interface NoteDocumentSidebarPanelProps {
  form: UseFormReturn<NoteFormData>;
  folders?: Folder[];
  editable?: boolean;
  editor: Editor | null;
  onViewModeInteract?: () => void;
}

export function NoteDocumentSidebarPanel({
  form,
  folders,
  editable = true,
  editor,
  onViewModeInteract,
}: NoteDocumentSidebarPanelProps) {
  return (
    <EntitySidebarCards defaultOpen={['outline', 'properties']}>
      <EntitySidebarCard value="outline" title="Outline">
        <NoteTableOfContents editor={editor} embedded />
      </EntitySidebarCard>

      <EntitySidebarCard value="properties" title="Properties">
        <NotePropertiesPanel
          form={form}
          folders={folders}
          editable={editable}
          embedded
          onViewModeInteract={onViewModeInteract}
        />
      </EntitySidebarCard>
    </EntitySidebarCards>
  );
}
