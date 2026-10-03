"use client";
import { useEntityPageRequest } from "@/shared/hooks/useEntityPageRequest";
interface ViewAdminShiftModalProps {
  isOpen: boolean;
  adminShiftId: string | null;
  onClose: () => void;
  onAdminShiftUpdated: () => void;
}
export function ViewAdminShiftModal({ isOpen, adminShiftId, onClose }: ViewAdminShiftModalProps) {
  useEntityPageRequest(isOpen, adminShiftId ? `/admin-shifts/${adminShiftId}` : null, onClose);
  return null;
}
