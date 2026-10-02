"use client";
import { useAccessoryRequest } from "@/shared/hooks/useAccessoryRequest";
interface EditTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string | null;
  onTaskUpdated?: () => void;
  issue?: { id: string; name: string | null } | null;
  project?: { id: string; name: string | null } | null;
}
export function EditTaskDialog({ isOpen, onClose, taskId }: EditTaskDialogProps) {
  useAccessoryRequest(isOpen, "task", taskId, onClose);
  return null;
}
