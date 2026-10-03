"use client";
import { useEntityPageRequest } from "@/shared/hooks/useEntityPageRequest";

type SessionModalProps = {
  isOpen: boolean;
  sessionId: string | null;
  onClose: () => void;
};

/** Legacy selection adapter. Entity content now lives in its full page. */
export function SessionModal({ isOpen, sessionId, onClose }: SessionModalProps) {
  useEntityPageRequest(isOpen, sessionId ? `/sessions/${sessionId}` : null, onClose);
  return null;
}
