"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import { useActiveSkillTrainerAttempt } from "@/features/skill-trainer/context/active-skill-trainer-attempt-context";
import { useQuotaLimitModal } from "@/features/ucat-access/context/quota-limit-context";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import {
  isMockEngineRoute,
  isSetEngineRoute,
  isSkillTrainerPlayRoute,
} from "@/features/ucat-access/lib/quota-area-for-pathname";
import { quotaPayloadFromUsage } from "@/features/ucat-access/lib/quota-payload-from-usage";
import type { UcatQuotaArea } from "@/features/ucat-access/types/quota";

type BlockedQuotaRoute = {
  area: UcatQuotaArea;
};

function getSearchValue(searchParams: URLSearchParams, names: string[]) {
  for (const name of names) {
    const value = searchParams.get(name);
    if (value) return value;
  }
  return null;
}

export function QuotaRouteGuard() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: quota, isLoading: quotaLoading } = useQuotaUsage();
  const { active: activeExamAttempt, isLoading: activeExamLoading } =
    useActiveExamAttempt();
  const {
    active: activeSkillTrainerAttempt,
    isLoading: activeSkillTrainerLoading,
  } = useActiveSkillTrainerAttempt();
  const { open, openQuotaLimit } = useQuotaLimitModal();
  const lastOpenedKeyRef = useRef<string | null>(null);

  const route = useMemo<BlockedQuotaRoute | null>(() => {
    if (isSetEngineRoute(pathname)) {
      const setId = getSearchValue(searchParams, ["setId", "id"]);
      const isCurrentAttempt =
        setId != null &&
        activeExamAttempt?.kind === "set" &&
        activeExamAttempt.resourceId === setId;
      if (activeExamLoading || isCurrentAttempt) return null;
      return { area: "sets" };
    }

    if (isMockEngineRoute(pathname)) {
      const mockId = getSearchValue(searchParams, ["mockId", "id"]);
      const isCurrentAttempt =
        mockId != null &&
        activeExamAttempt?.kind === "mock" &&
        activeExamAttempt.resourceId === mockId;
      if (activeExamLoading || isCurrentAttempt) return null;
      return { area: "mocks" };
    }

    if (isSkillTrainerPlayRoute(pathname)) {
      const attemptId = searchParams.get("attemptId");
      const isCurrentAttempt =
        attemptId != null &&
        activeSkillTrainerAttempt?.attempt.id === attemptId &&
        !activeSkillTrainerAttempt.isCompleted;
      if (activeSkillTrainerLoading || isCurrentAttempt) return null;
      return { area: "skill_trainer" };
    }

    return null;
  }, [
    activeExamAttempt,
    activeExamLoading,
    activeSkillTrainerAttempt,
    activeSkillTrainerLoading,
    pathname,
    searchParams,
  ]);

  useEffect(() => {
    if (!route || open || quotaLoading) return;
    if (!quota || quota.onlineTier !== "free" || quota.isQuotaExempt) return;

    const areaUsage = quota.areas.find((area) => area.area === route.area);
    if (!areaUsage || (!areaUsage.disabled && !areaUsage.atLimit)) return;

    const openedKey = [
      pathname,
      searchParams.toString(),
      route.area,
      areaUsage.used,
      areaUsage.limit,
      areaUsage.period,
    ].join("|");
    if (lastOpenedKeyRef.current === openedKey) return;
    lastOpenedKeyRef.current = openedKey;

    openQuotaLimit(quotaPayloadFromUsage(areaUsage), {
      dismissAction: {
        label: "Back to dashboard",
        onDismiss: () => router.replace("/dashboard"),
        variant: "dashboard",
      },
    });
  }, [
    open,
    openQuotaLimit,
    pathname,
    quota,
    quotaLoading,
    route,
    router,
    searchParams,
  ]);

  return null;
}
