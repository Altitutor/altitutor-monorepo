"use client";

import { CheckCircle2, Clock } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isUcatSkillTrainerKey, trainerKeyToSlug } from "@altitutor/shared";
import { useActiveSkillTrainerAttempt } from "@/features/skill-trainer/context/active-skill-trainer-attempt-context";
import { useSkillTrainers } from "@/features/skill-trainer/hooks/use-skill-trainers";
import { formatTimeRemaining } from "@/features/question-engine/lib/timing";
import { isSkillTrainerPlayRoute } from "@/features/ucat-access/lib/quota-area-for-pathname";
import { HeaderStatusPill } from "@/shared/components/header-status-pill";

const DISMISSED_STORAGE_KEY = "ucat-dismissed-skill-trainer-attempts";

function formatTrainerName(key: string): string {
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

export function SkillTrainerAttemptHeaderPill() {
  const pathname = usePathname();
  const { active, refresh, setLocal } = useActiveSkillTrainerAttempt();
  const { data: trainers } = useSkillTrainers();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDismissedIds(readDismissedAttemptIds());
  }, []);

  useEffect(() => {
    if (!active || active.isCompleted) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  const remaining = useMemo(() => {
    if (!active || active.isCompleted) return null;
    const endsAtMs = new Date(active.attempt.ends_at).getTime();
    if (Number.isNaN(endsAtMs)) return active.remainingSeconds;
    return Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000));
  }, [active, nowMs]);

  useEffect(() => {
    if (remaining !== 0) return;
    if (active && !active.isCompleted) {
      setLocal({
        ...active,
        remainingSeconds: 0,
        isExpired: true,
        isCompleted: true,
        attempt: {
          ...active.attempt,
          completed_at: active.attempt.completed_at ?? new Date().toISOString(),
        },
      });
    }
    void refresh();
  }, [active, refresh, remaining, setLocal]);

  const dismiss = useCallback((attemptId: string) => {
    persistDismissedAttemptId(attemptId);
    setDismissedIds((prev) => new Set(prev).add(attemptId));
  }, []);

  if (isSkillTrainerPlayRoute(pathname)) return null;
  if (!active) return null;
  if (active.isCompleted && dismissedIds.has(active.attempt.id)) return null;

  const trainerKey =
    active.attempt.config_snapshot.trainer_key ??
    (active.attempt.trainer_key && isUcatSkillTrainerKey(active.attempt.trainer_key)
      ? active.attempt.trainer_key
      : null);

  if (!trainerKey) return null;

  const trainer = trainers?.find((item) => item.key === trainerKey);
  if (trainers && !trainer) return null;

  const trainerName =
    trainer?.name ?? formatTrainerName(trainerKey);
  const skillTrainerHref = `/skill-trainer/${trainerKeyToSlug(trainerKey)}`;
  const href = `${skillTrainerHref}/play?attemptId=${active.attempt.id}`;

  return (
    <HeaderStatusPill
      variant={active.isCompleted ? "emerald" : "amber"}
      icon={
        active.isCompleted ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <Clock className="h-3.5 w-3.5" />
        )
      }
      action={{
        type: "link",
        href,
        label: active.isCompleted ? "View attempt" : "Resume",
      }}
      onDismiss={
        active.isCompleted ? () => dismiss(active.attempt.id) : undefined
      }
    >
      <span className="font-medium">
        Skill trainer {active.isCompleted ? "complete" : "in progress"}
      </span>
      <span className="hidden sm:inline"> · {trainerName}</span>
      {!active.isCompleted && remaining != null ? (
        <span className="ml-1 tabular-nums opacity-80">
          ({formatTimeRemaining(remaining)})
        </span>
      ) : null}
    </HeaderStatusPill>
  );
}
