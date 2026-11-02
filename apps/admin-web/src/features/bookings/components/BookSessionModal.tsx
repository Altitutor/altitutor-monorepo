"use client";
import { ManualMeetingModal } from "./ManualMeetingModal";

export interface BookSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionType: "DRAFTING" | "TRIAL_SESSION" | "SUBSIDY_INTERVIEW";
  onBookingCreated?: (sessionId: string) => void;
  initialStudentId?: string;
  initialCreateStudent?: {
    phone: string;
    phoneOwner: "student" | "parent";
  } | null;
  originalSessionId?: string | null;
  originalSubjectId?: string | null;
}

export function BookSessionModal(props: BookSessionModalProps) {
  return <ManualMeetingModal {...props} />;
}
