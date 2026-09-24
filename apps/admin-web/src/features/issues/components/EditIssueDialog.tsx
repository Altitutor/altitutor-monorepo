'use client';

import { AdminDialogShell } from '@/shared/components';
import { IssueDetailView } from './IssueDetailView';

interface EditIssueDialogProps {
  isOpen: boolean;
  onClose: () => void;
  issueId: string | null;
  onIssueUpdated?: () => void;
}

export function EditIssueDialog({ isOpen, onClose, issueId, onIssueUpdated }: EditIssueDialogProps) {
  if (!issueId || !isOpen) return null;

  return (
    <AdminDialogShell
      hideHeader
      fillHeight
      defaultExpanded
      open={isOpen}
      onClose={onClose}
      title="Edit Issue"
      contentClassName="md:max-w-4xl"
      bodyClassName="flex min-h-0 flex-1 flex-col p-0 overflow-hidden"
    >
      <IssueDetailView
        issueId={issueId}
        enabled={isOpen}
        onClose={onClose}
        onIssueUpdated={onIssueUpdated}
        variant="dialog"
      />
    </AdminDialogShell>
  );
}
