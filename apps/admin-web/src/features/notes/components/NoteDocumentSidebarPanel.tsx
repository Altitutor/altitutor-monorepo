'use client';

import type { ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { Editor } from '@tiptap/react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  ScrollArea,
} from '@altitutor/ui';
import type { Folder, NoteFormData } from '../types';
import { NotePropertiesPanel } from './NotePropertiesPanel';
import { NoteTableOfContents } from './NoteTableOfContents';

function SidebarCard({
  value,
  title,
  children,
}: {
  value: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <AccordionItem value={value} className="border-0">
      <div className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
        <AccordionTrigger className="px-3 py-2.5 hover:no-underline [&>svg]:text-muted-foreground">
          <span className="text-sm font-semibold">{title}</span>
        </AccordionTrigger>
        <AccordionContent className="space-y-1 border-t border-border/60 px-3 pb-4 pt-2">
          {children}
        </AccordionContent>
      </div>
    </AccordionItem>
  );
}

interface NoteDocumentSidebarPanelProps {
  form: UseFormReturn<NoteFormData>;
  folders?: Folder[];
  editable?: boolean;
  editor: Editor | null;
  onViewModeInteract?: () => void;
}

/**
 * Combined document sidebar: Outline card above Properties card (UCAT-style accordion cards).
 */
export function NoteDocumentSidebarPanel({
  form,
  folders,
  editable = true,
  editor,
  onViewModeInteract,
}: NoteDocumentSidebarPanelProps) {
  return (
    <ScrollArea className="h-full min-h-0 flex-1">
      <div className="space-y-4 p-4" onPointerDownCapture={onViewModeInteract}>
        <Accordion
          type="multiple"
          defaultValue={['outline', 'properties']}
          className="space-y-4"
        >
          <SidebarCard value="outline" title="Outline">
            <NoteTableOfContents editor={editor} embedded />
          </SidebarCard>

          <SidebarCard value="properties" title="Properties">
            <NotePropertiesPanel
              form={form}
              folders={folders}
              editable={editable}
              embedded
            />
          </SidebarCard>
        </Accordion>
      </div>
    </ScrollArea>
  );
}
