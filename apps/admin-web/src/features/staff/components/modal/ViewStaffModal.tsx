"use client";
import { useEntityPageRequest } from "@/shared/hooks/useEntityPageRequest";

interface ViewStaffModalProps {
  isOpen: boolean;
  staffId: string | null;
  onClose: () => void;
  onStaffUpdated: () => void;
  /** When the modal opens, select this tab (e.g. `pay-tier` from Pay tiers page). */
  initialTab?: string;
}

/** Legacy selection adapter. Entity content now lives in its full page. */
export function ViewStaffModal({ isOpen, staffId, onClose, initialTab }: ViewStaffModalProps) {
  useEntityPageRequest(isOpen, staffId ? `/staff/${staffId}${initialTab ? `?tab=${encodeURIComponent(initialTab)}` : ""}` : null, onClose);
  return null;
}
