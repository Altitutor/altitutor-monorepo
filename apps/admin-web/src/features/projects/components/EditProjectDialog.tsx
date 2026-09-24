'use client';

import { AdminDialogShell } from '@/shared/components';
import { ProjectDetailView } from './ProjectDetailView';

interface EditProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
}

export function EditProjectDialog({ isOpen, onClose, projectId }: EditProjectDialogProps) {
  if (!projectId || !isOpen) return null;

  return (
    <AdminDialogShell
      hideHeader
      fillHeight
      defaultExpanded
      open={isOpen}
      onClose={onClose}
      title="Edit Project"
      contentClassName="md:max-w-4xl"
      bodyClassName="flex min-h-0 flex-1 flex-col p-0 overflow-hidden"
    >
      <ProjectDetailView
        projectId={projectId}
        enabled={isOpen}
        onClose={onClose}
        variant="dialog"
      />
    </AdminDialogShell>
  );
}
