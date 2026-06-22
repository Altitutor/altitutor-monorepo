"use client";

import Link from "next/link";
import { CheckCircle2, Clock, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import {
  attemptBannerStatusLabel,
  isAttemptAtResults,
} from "@/features/exam-attempts/lib/banner-copy";
import { getRemainingSecondsFromEndsAt } from "@/lib/ucat/exam-attempt/timing";
import { formatTimeRemaining } from "@/features/question-engine/lib/timing";
import { cn } from "@/lib/utils";

const DISMISSED_STORAGE_KEY = "ucat-dismissed-exam-attempts";

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

  if (!active) return null;

  if (
    atResults &&
    (viewingCompletedAttempt || dismissedIds.has(active.attemptId))
  ) {
    return null;
  }

  const statusLabel = attemptBannerStatusLabel(active);
  const remaining =
    !atResults && active.currentSegmentEndsAt
      ? getRemainingSecondsFromEndsAt(active.currentSegmentEndsAt)
      : null;
  const actionHref = atResults ? active.resultsHref : active.resumeHref;
  const actionLabel = atResults ? "View results" : "Resume";

  return (
    <div
      role="status"
      className={cn(
        "flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-sm",
        atResults
          ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-50"
          : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-50",
      )}
    >
      {atResults ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      <span className="min-w-0 truncate">
        <span className="font-medium">{statusLabel}</span>
        <span className="hidden sm:inline"> · {active.label}</span>
        {remaining != null ? (
          <span className="ml-1 tabular-nums opacity-80">
            ({formatTimeRemaining(remaining)})
          </span>
        ) : null}
      </span>
      <Link
        href={actionHref}
        prefetch={false}
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 font-medium transition-colors",
          atResults
            ? "bg-emerald-900 text-emerald-50 hover:bg-emerald-800 dark:bg-emerald-100 dark:text-emerald-950 dark:hover:bg-emerald-200"
            : "bg-amber-900 text-amber-50 hover:bg-amber-800 dark:bg-amber-100 dark:text-amber-950 dark:hover:bg-amber-200",
        )}
      >
        {actionLabel}
      </Link>
      {atResults ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            dismiss(active.attemptId);
          }}
          className="shrink-0 rounded-full p-0.5 text-emerald-900/70 transition-colors hover:bg-emerald-900/10 hover:text-emerald-900 dark:text-emerald-100/70 dark:hover:bg-emerald-100/10 dark:hover:text-emerald-100"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
