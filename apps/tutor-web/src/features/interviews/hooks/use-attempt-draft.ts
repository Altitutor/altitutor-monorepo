"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  InterviewStationAttempt,
  InterviewFeedback,
  InterviewCommand,
} from "@altitutor/shared";
import { sendInterviewCommand } from "../api/interviews";

export interface AttemptDraft {
  score: number | null;
  notAssessedReason: string | null;
  feedback: InterviewFeedback[];
}
export function attemptDraft(attempt: InterviewStationAttempt): AttemptDraft {
  return {
    score: attempt.score,
    notAssessedReason: attempt.notAssessedReason,
    feedback: attempt.feedback,
  };
}

/** Serial saves retain edits made while an earlier revision is in flight. A rejected write never discards the draft. */
export function useAttemptDraft(roundId: string, attempt: InterviewStationAttempt) {
  const [draft, setDraft] = useState<AttemptDraft>(() => attemptDraft(attempt));
  const current = useRef(draft);
  const saved = useRef(JSON.stringify(draft));
  const version = useRef(attempt.version);
  const flight = useRef<Promise<void> | null>(null);
  const pendingCommand = useRef<Extract<
    InterviewCommand,
    { type: "saveAttempt" }
  > | null>(null);
  const [state, setState] = useState<"saved" | "unsaved" | "saving" | "failed">(
    "saved",
  );
  const [error, setError] = useState<Error | null>(null);
  const storageKey = `interview-draft:${roundId}:${attempt.id}`;
  useEffect(() => {
    const stored = sessionStorage.getItem(storageKey);
    if (!stored) return;
    try {
      const recovery = JSON.parse(stored) as {
        draft: AttemptDraft;
        version: number;
        pendingCommand?: Extract<InterviewCommand, { type: "saveAttempt" }>;
      };
      pendingCommand.current = recovery.pendingCommand ?? null;
      version.current = recovery.version;
      if (recovery.version === attempt.version || recovery.pendingCommand) {
        current.current = recovery.draft;
        setDraft(recovery.draft);
        setState("unsaved");
      } else {
        current.current = recovery.draft;
        setDraft(recovery.draft);
        setState("failed");
        setError(
          new Error(
            "Your recovered draft has a newer saved revision. Review the draft below before choosing which version to keep.",
          ),
        );
      }
    } catch {
      sessionStorage.removeItem(storageKey);
    }
    // Keyed editor mounts once per attempt. Later server updates are reconciled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  useEffect(() => {
    if (
      !flight.current &&
      JSON.stringify(current.current) === saved.current &&
      attempt.version >= version.current
    ) {
      const next = attemptDraft(attempt);
      current.current = next;
      saved.current = JSON.stringify(next);
      version.current = attempt.version;
      setDraft(next);
    }
  }, [attempt]);
  const update = useCallback(
    (next: AttemptDraft) => {
      current.current = next;
      setDraft(next);
      setState("unsaved");
      setError(null);
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          draft: next,
          version: version.current,
          pendingCommand: pendingCommand.current,
        }),
      );
    },
    [storageKey],
  );
  const flush = useCallback(async (): Promise<void> => {
    if (flight.current) {
      await flight.current;
      return;
    }
    const save = async () => {
      while (
        pendingCommand.current ||
        JSON.stringify(current.current) !== saved.current
      ) {
        const command = pendingCommand.current ?? {
          type: "saveAttempt" as const,
          commandId: crypto.randomUUID(),
          roundId,
          attemptId: attempt.id,
          expectedAttemptVersion: version.current,
          ...current.current,
        };
        pendingCommand.current = command;
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            draft: current.current,
            version: version.current,
            pendingCommand: command,
          }),
        );
        setState("saving");
        const result = await sendInterviewCommand(command);
        const snapshot: AttemptDraft = {
          score: command.score,
          notAssessedReason: command.notAssessedReason,
          feedback: command.feedback,
        };
        pendingCommand.current = null;
        version.current = result.version;
        saved.current = JSON.stringify(snapshot);
      }
      sessionStorage.removeItem(storageKey);
      setState("saved");
      setError(null);
    };
    const pending = save()
      .catch((reason: unknown) => {
        if (
          reason instanceof Error &&
          "status" in reason &&
          typeof reason.status === "number" &&
          reason.status >= 400 &&
          reason.status < 500
        ) {
          pendingCommand.current = null;
          sessionStorage.setItem(
            storageKey,
            JSON.stringify({
              draft: current.current,
              version: version.current,
            }),
          );
        }
        const next =
          reason instanceof Error
            ? reason
            : new Error("Feedback could not be saved.");
        setState("failed");
        setError(next);
        throw next;
      })
      .finally(() => {
        flight.current = null;
      });
    flight.current = pending;
    await pending;
  }, [attempt.id, roundId, storageKey]);
  useEffect(() => {
    if (state !== "unsaved") return;
    const timer = setTimeout(() => {
      void flush().catch(() => undefined);
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, flush, state]);
  const newerRevision =
    attempt.version > version.current &&
    JSON.stringify(current.current) !== saved.current;
  const loadSaved = () => {
    if (flight.current) return;
    const next = attemptDraft(attempt);
    pendingCommand.current = null;
    version.current = attempt.version;
    current.current = next;
    saved.current = JSON.stringify(next);
    setDraft(next);
    setState("saved");
    setError(null);
    sessionStorage.removeItem(storageKey);
  };
  const keepDraft = () => {
    if (flight.current) return;
    pendingCommand.current = null;
    version.current = attempt.version;
    saved.current = JSON.stringify(attemptDraft(attempt));
    update(current.current);
  };
  return {
    draft,
    update,
    flush,
    state,
    error,
    newerRevision,
    loadSaved,
    keepDraft,
  };
}
