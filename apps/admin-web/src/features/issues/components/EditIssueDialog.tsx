"use client";
import { useAccessoryRequest } from "@/shared/hooks/useAccessoryRequest";
interface EditIssueDialogProps {
  isOpen: boolean;
  onClose: () => void;
  issueId: string | null;
  onIssueUpdated?: () => void;
}
export function EditIssueDialog({ isOpen, onClose, issueId }: EditIssueDialogProps) {
  useAccessoryRequest(isOpen, "issue", issueId, onClose);
  return null;
}
