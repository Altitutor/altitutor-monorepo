"use client";

import { useCallback } from "react";
import type { MouseEvent } from "react";
import { useQuotaLimitModal } from "@/features/ucat-access/context/quota-limit-context";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";

type LearnQuotaLesson = {
  kind?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
};

export function useLearnQuotaGate() {
  const { data: quota } = useQuotaUsage();
  const { openQuotaLimit } = useQuotaLimitModal();

  const isBlocked = useCallback(
    (lesson: LearnQuotaLesson | null | undefined) => {
      if (!lesson || lesson.kind !== "lesson") return false;
      if (lesson.started_at || lesson.completed_at) return false;
      if (!quota || quota.onlineTier !== "free" || quota.isQuotaExempt) return false;
      const learnQuota = quota.areas.find((area) => area.area === "learn");
      return Boolean(
        learnQuota &&
          (learnQuota.disabled ||
            learnQuota.limit === 0 ||
            learnQuota.used >= learnQuota.limit),
      );
    },
    [quota],
  );

  const openLimit = useCallback(() => {
    const learnQuota = quota?.areas.find((area) => area.area === "learn");
    if (!learnQuota) return;
    openQuotaLimit(
      {
        code: "QUOTA_EXCEEDED",
        area: "learn",
        used: learnQuota.used,
        limit: learnQuota.limit,
        period: learnQuota.period,
      },
      {
        dismissAction: { label: "Dismiss", variant: "dismiss" },
      },
    );
  }, [openQuotaLimit, quota]);

  const guardLessonClick = useCallback(
    (
      event: MouseEvent<HTMLAnchorElement>,
      lesson: LearnQuotaLesson | null | undefined,
    ) => {
      if (!isBlocked(lesson)) return;
      event.preventDefault();
      openLimit();
    },
    [isBlocked, openLimit],
  );

  return { guardLessonClick, isLearnLessonBlocked: isBlocked };
}
