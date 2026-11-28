"use client";
import { useMemo } from "react";
import type { BookingModalPrefill } from "@/shared/contexts/QuickActionsContext";
import { ManualMeetingModal } from "./ManualMeetingModal";

export interface BookSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionType: "DRAFTING" | "TRIAL_SESSION" | "SUBSIDY_INTERVIEW";
  onBookingCreated?: (sessionId: string) => void;
  initialStudentId?: string;
  initialParent?: BookingModalPrefill['initialParent'];
  initialCreateStudent?: {
    phone: string;
    phoneOwner: "student" | "parent";
  } | null;
  originalSessionId?: string | null;
  originalSubjectId?: string | null;
}

export function BookSessionModal({ initialParent, ...props }: BookSessionModalProps) {
  const prefill = useMemo(
    () => initialParent ? { parents: [initialParent] } : undefined,
    [initialParent],
  );
  return <ManualMeetingModal {...props} initialPrefill={prefill} />;
}
