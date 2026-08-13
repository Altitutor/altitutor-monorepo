'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from '@altitutor/ui';
import {
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';
import { ProjectDetailView } from './ProjectDetailView';

interface EditProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
}

export function EditProjectDialog({ isOpen, onClose, projectId }: EditProjectDialogProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);

  if (!projectId || !isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          'w-full md:max-w-4xl h-[90vh] grid grid-rows-[minmax(0,1fr)] overflow-hidden p-0 gap-0 [&>button]:hidden',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <ProjectDetailView
          projectId={projectId}
          enabled={isOpen}
          onClose={onClose}
          variant="dialog"
          expanded={expanded}
          onExpandedChange={setExpanded}
        />
      </DialogContent>
    </Dialog>
  );
}
