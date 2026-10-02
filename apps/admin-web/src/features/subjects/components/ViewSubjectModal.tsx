"use client";
import { useEntityPageRequest } from "@/shared/hooks/useEntityPageRequest";

export interface ViewSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectId: string | null;
  onSubjectUpdated?: () => void;
}

/** Legacy selection adapter. Entity content now lives in its full page. */
export function ViewSubjectModal({ isOpen, subjectId, onClose }: ViewSubjectModalProps) {
  useEntityPageRequest(isOpen, subjectId ? `/subjects/${subjectId}` : null, onClose);
  return null;
}
