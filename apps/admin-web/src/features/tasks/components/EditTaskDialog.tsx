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
import { TaskDetailView } from './TaskDetailView';

interface EditTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string | null;
  onTaskUpdated?: () => void;
  issue?: { id: string; name: string | null } | null;
  project?: { id: string; name: string | null } | null;
}

export function EditTaskDialog({
  isOpen,
  onClose,
  taskId,
  onTaskUpdated,
  issue,
  project,
}: EditTaskDialogProps) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!isOpen) setExpanded(true);
  }, [isOpen]);

  if (!taskId || !isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          'w-full md:max-w-4xl h-[90vh] grid grid-rows-[minmax(0,1fr)] overflow-hidden p-0 gap-0 [&>button]:hidden',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <TaskDetailView
          taskId={taskId}
          enabled={isOpen}
          onClose={onClose}
          onTaskUpdated={onTaskUpdated}
          issue={issue}
          project={project}
          variant="dialog"
          expanded={expanded}
          onExpandedChange={setExpanded}
        />
      </DialogContent>
    </Dialog>
  );
}
