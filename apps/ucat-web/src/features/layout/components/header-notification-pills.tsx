"use client";

import { motion } from "motion/react";
import { ExamAttemptHeaderPill } from "@/features/exam-attempts/components/exam-attempt-header-pill";
import { QuotaHeaderPill } from "@/features/ucat-access/components/quota-header-pill";
import { BillingRecoveryHeaderPill } from "@/features/subscription/components/billing-recovery-header-pill";

export function HeaderNotificationPills() {
  return (
    <div className="flex w-full min-w-0 flex-nowrap items-center justify-start gap-2 overflow-x-auto overscroll-x-contain sm:justify-center">
      <ExamAttemptHeaderPill />
      <BillingRecoveryHeaderPill />
      <motion.div
        className="min-w-0 max-w-full shrink-0"
        layout
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      >
        <QuotaHeaderPill />
      </motion.div>
    </div>
  );
}
