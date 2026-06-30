"use client";

import { CheckCircle2, Clock } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import {
  attemptBannerStatusLabel,
  isAttemptAtResults,
} from "@/features/exam-attempts/lib/banner-copy";
import { getRemainingSecondsFromEndsAt } from "@/lib/ucat/exam-attempt/timing";
import { formatTimeRemaining } from "@/features/question-engine/lib/timing";
import { isPracticeEngineRoute } from "@/features/ucat-access/lib/quota-area-for-pathname";
import { HeaderStatusPill } from "@/shared/components/header-status-pill";

const DISMISSED_STORAGE_KEY = "ucat-dismissed-exam-attempts";

function isImmersiveHeaderRoute(pathname: string): boolean {
  return pathname.startsWith("/exam") || isPracticeEngineRoute(pathname);
}

function readDismissedAttemptIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function persistDismissedAttemptId(attemptId: string) {
  const next = readDismissedAttemptIds();
  next.add(attemptId);
  sessionStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify([...next]));
}

export function ExamAttemptHeaderPill() {
  const pathname = usePathname();
  const { active, refresh } = useActiveExamAttempt();
  const [tick, setTick] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const catchUpRequestedRef = useRef(false);

  useEffect(() => {
    setDismissedIds(readDismissedAttemptIds());
  }, []);

  useEffect(() => {
    if (!active?.currentSegmentEndsAt || isAttemptAtResults(active)) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!active?.currentSegmentEndsAt || isAttemptAtResults(active)) {
      catchUpRequestedRef.current = false;
      return;
    }
    const remaining = getRemainingSecondsFromEndsAt(active.currentSegmentEndsAt);
    if (remaining > 0) {
      catchUpRequestedRef.current = false;
      return;
    }
    if (catchUpRequestedRef.current) return;
    catchUpRequestedRef.current = true;
    void refresh().finally(() => {
      catchUpRequestedRef.current = false;
    });
  }, [active, refresh, tick]);

  const dismiss = useCallback((attemptId: string) => {
    persistDismissedAttemptId(attemptId);
    setDismissedIds((prev) => new Set(prev).add(attemptId));
  }, []);

  const atResults = active ? isAttemptAtResults(active) : false;
  const viewingCompletedAttempt =
    active != null && atResults && pathname === active.resultsHref;

  useEffect(() => {
    if (active && viewingCompletedAttempt) dismiss(active.attemptId);
  }, [active, viewingCompletedAttempt, dismiss]);

  if (isImmersiveHeaderRoute(pathname)) return null;
  if (!active) return null;

  if (atResults && (viewingCompletedAttempt || dismissedIds.has(active.attemptId))) {
    return null;
  }

  const statusLabel = attemptBannerStatusLabel(active);
  const remaining =
    !atResults && active.currentSegmentEndsAt
      ? getRemainingSecondsFromEndsAt(active.currentSegmentEndsAt)
      : null;
  const actionHref = atResults ? active.resultsHref : active.resumeHref;
  const actionLabel = atResults ? "View attempt" : "Resume";

  return (
    <HeaderStatusPill
      variant={atResults ? "emerald" : "amber"}
      icon={
        atResults ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <Clock className="h-3.5 w-3.5" />
        )
      }
      action={{
        type: "link",
        href: actionHref,
        label: actionLabel,
      }}
      onDismiss={atResults ? () => dismiss(active.attemptId) : undefined}
    >
      <span className="font-medium">{statusLabel}</span>
      <span className="hidden sm:inline"> · {active.label}</span>
      {remaining != null ? (
        <span className="ml-1 tabular-nums opacity-80">
          ({formatTimeRemaining(remaining)})
        </span>
      ) : null}
    </HeaderStatusPill>
  );
}
