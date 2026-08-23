'use client';

import { AdminDialogShell } from '@/shared/components';
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
  if (!taskId || !isOpen) return null;

  return (
    <AdminDialogShell
      hideHeader
      fillHeight
      defaultExpanded
      open={isOpen}
      onClose={onClose}
      title="Edit Task"
      contentClassName="md:max-w-4xl"
      bodyClassName="flex min-h-0 flex-1 flex-col p-0 overflow-hidden"
    >
      <TaskDetailView
        taskId={taskId}
        enabled={isOpen}
        onClose={onClose}
        onTaskUpdated={onTaskUpdated}
        issue={issue}
        project={project}
        variant="dialog"
      />
    </AdminDialogShell>
  );
}
