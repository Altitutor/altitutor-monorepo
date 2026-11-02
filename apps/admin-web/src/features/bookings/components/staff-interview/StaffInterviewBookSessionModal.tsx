"use client";
import { ManualMeetingModal } from "../ManualMeetingModal";

export interface StaffInterviewBookSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookingCreated?: (sessionId: string) => void;
  initialPhone?: string | null;
}

export function StaffInterviewBookSessionModal({
  initialPhone,
  ...props
}: StaffInterviewBookSessionModalProps) {
  return (
    <ManualMeetingModal
      {...props}
      sessionType="STAFF_INTERVIEW"
      initialStaffPhone={initialPhone ?? undefined}
    />
  );
}
