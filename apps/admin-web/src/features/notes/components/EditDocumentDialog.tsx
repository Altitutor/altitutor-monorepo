"use client";
import { useAccessoryRequest } from "@/shared/hooks/useAccessoryRequest";
interface EditDocumentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: string | null;
}
export function EditDocumentDialog({
  isOpen,
  onClose,
  noteId,
}: EditDocumentDialogProps) {
  useAccessoryRequest(isOpen, "document", noteId, onClose);
  return null;
}
