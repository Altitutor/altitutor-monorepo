"use client";
import { useEntityPageRequest } from "@/shared/hooks/useEntityPageRequest";

interface ViewClassModalProps {
  isOpen: boolean;
  classId: string | null;
  onClose: () => void;
  onClassUpdated: () => void;
}

/** Legacy selection adapter. Entity content now lives in its full page. */
export function ViewClassModal({ isOpen, classId, onClose }: ViewClassModalProps) {
  useEntityPageRequest(isOpen, classId ? `/classes/${classId}` : null, onClose);
  return null;
}
