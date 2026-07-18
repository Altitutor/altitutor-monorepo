"use client";

import { motion } from "motion/react";
import { ExamAttemptHeaderPill } from "@/features/exam-attempts/components/exam-attempt-header-pill";
import { QuotaHeaderPill } from "@/features/ucat-access/components/quota-header-pill";
import { BillingRecoveryHeaderPill } from "@/features/subscription/components/billing-recovery-header-pill";

export function HeaderNotificationPills() {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
      <ExamAttemptHeaderPill />
      <BillingRecoveryHeaderPill />
      <motion.div
        layout
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      >
        <QuotaHeaderPill />
      </motion.div>
    </div>
  );
}
