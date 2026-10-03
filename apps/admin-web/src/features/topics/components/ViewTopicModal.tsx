"use client";
import { useEntityPageRequest } from "@/shared/hooks/useEntityPageRequest";

export interface ViewTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicId: string | null;
  onTopicUpdated?: () => void;
}

/** Legacy selection adapter. Entity content now lives in its full page. */
export function ViewTopicModal({ isOpen, topicId, onClose }: ViewTopicModalProps) {
  useEntityPageRequest(isOpen, topicId ? `/topics/${topicId}` : null, onClose);
  return null;
}
