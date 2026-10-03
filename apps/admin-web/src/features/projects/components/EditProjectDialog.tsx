"use client";
import { useAccessoryRequest } from "@/shared/hooks/useAccessoryRequest";
interface EditProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
}
export function EditProjectDialog({ isOpen, onClose, projectId }: EditProjectDialogProps) {
  useAccessoryRequest(isOpen, "project", projectId, onClose);
  return null;
}
