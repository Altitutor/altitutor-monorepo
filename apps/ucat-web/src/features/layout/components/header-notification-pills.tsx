"use client";

import { ExamAttemptHeaderPill } from "@/features/exam-attempts/components/exam-attempt-header-pill";
import { QuotaHeaderPill } from "@/features/ucat-access/components/quota-header-pill";

export function HeaderNotificationPills() {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
      <ExamAttemptHeaderPill />
      <QuotaHeaderPill />
    </div>
  );
}
