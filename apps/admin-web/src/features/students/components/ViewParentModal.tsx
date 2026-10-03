"use client";
import { useEntityPageRequest } from "@/shared/hooks/useEntityPageRequest";

interface ViewParentModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId: string | null;
  onParentUpdated?: () => void;
  defaultTab?: string;
}

/** Legacy selection adapter. Entity content now lives in its full page. */
export function ViewParentModal({ isOpen, parentId, onClose, defaultTab }: ViewParentModalProps) {
  useEntityPageRequest(isOpen, parentId ? `/parents/${parentId}${defaultTab ? `?tab=${encodeURIComponent(defaultTab)}` : ""}` : null, onClose);
  return null;
}
