"use client";

import { AdminDialogShell } from "@/shared/components";
import { DocumentDetailView } from "./DocumentDetailView";
interface EditDocumentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: string | null;
  /** Retained for callers; documents now automatically edit whenever the lease is available. */
  initialMode?: "view" | "edit";
}
export function EditDocumentDialog({
  isOpen,
  onClose,
  noteId,
}: EditDocumentDialogProps) {
  if (!isOpen || !noteId) return null;
  return (
    <AdminDialogShell
      hideHeader
      fillHeight
      defaultExpanded
      open={isOpen}
      onClose={onClose}
      title="Document"
      contentClassName="md:max-w-4xl"
      bodyClassName="flex min-h-0 flex-1 flex-col p-0 overflow-hidden"
      dialogContentProps={{
        onInteractOutside: (event) => event.preventDefault(),
        onEscapeKeyDown: (event) => event.preventDefault(),
      }}
    >
      <DocumentDetailView
        key={noteId}
        noteId={noteId}
        onClose={onClose}
        variant="dialog"
      />
    </AdminDialogShell>
  );
}
