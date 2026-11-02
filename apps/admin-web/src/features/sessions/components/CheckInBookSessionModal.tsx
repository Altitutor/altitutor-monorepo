"use client";
import type {
  CheckInModalPrefill,
  CheckInSessionType,
} from "@/shared/contexts/QuickActionsContext";
import { ManualMeetingModal } from "@/features/bookings/components/ManualMeetingModal";

export type CheckInBookSessionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (sessionId: string, staffIds: string[]) => void;
  sessionType?: CheckInSessionType;
  /** Applied when the dialog opens (from global quick actions or entity menus) */
  initialPrefill?: CheckInModalPrefill | null;
};

export function CheckInBookSessionModal({
  onCreated,
  sessionType = "CHECK_IN",
  ...props
}: CheckInBookSessionModalProps) {
  return (
    <ManualMeetingModal
      {...props}
      sessionType={sessionType}
      onBookingCreated={onCreated}
    />
  );
}
