"use client";
import { useEntityPageRequest } from "@/shared/hooks/useEntityPageRequest";

interface ViewStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string | null;
  onStudentUpdated: () => void;
  defaultTab?: 'details' | 'online' | 'classes' | 'messages' | 'sessions' | 'files' | 'billing' | 'activity';
}

/** Legacy selection adapter. Entity content now lives in its full page. */
export function ViewStudentModal({ isOpen, studentId, onClose, defaultTab }: ViewStudentModalProps) {
  useEntityPageRequest(isOpen, studentId ? `/students/${studentId}${defaultTab ? `?tab=${encodeURIComponent(defaultTab)}` : ""}` : null, onClose);
  return null;
}
