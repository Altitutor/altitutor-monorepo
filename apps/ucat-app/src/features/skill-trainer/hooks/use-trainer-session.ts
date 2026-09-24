import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { api, ApiError } from "@/lib/api";
import type {
  SkillTrainerAttemptState,
  SubmitActionPayload,
} from "../types/attempt";
import type { TrainerReviewItem } from "../components/trainer-review";
import { createTrainerActionQueue } from "../lib/action-queue";
import {
  expireLocalSkillTrainerSession,
  submitLocalSkillTrainerAction,
} from "../lib/local-session";

export type PreparedTrainer = {
  session: SkillTrainerAttemptState;
  items: { id: string; content: Record<string, unknown> }[];
  trainerName: string;
};
export function useTrainerSession({
  blockId,
  taskId,
}: { blockId?: string; taskId?: string } = {}) {
  const client = useQueryClient();
  const [state, setState] = useState<SkillTrainerAttemptState | null>(null);
  const latest = useRef(state);
  const [prepared, setPrepared] = useState<PreparedTrainer | null>(null);
  const preparedRef = useRef<PreparedTrainer | null>(null);
  const [localReview, setLocalReview] = useState<TrainerReviewItem[]>([]);
  const [pending, setPending] = useState(0);
  const [queueReady, setQueueReady] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [now, setNow] = useState(Date.now);
  const [feedback, setFeedback] = useState<{
    id: number;
    correct: boolean;
    scoreDelta: number;
  } | null>(null);
  const feedbackId = useRef(0);
  const queue = useRef<ReturnType<typeof createTrainerActionQueue> | null>(
    null,
  );
  const itemScore = useRef(0);
  const generation = useRef(0);
  const completion = useRef({ started: false, done: false });
  const expiry = useRef(false);
  const discardedFailed = useRef(false);
  const nextExpiryPoll = useRef(0);
  const [completing, setCompleting] = useState(false);
  function apply(next: SkillTrainerAttemptState | null) {
    latest.current = next;
    setState(next);
  }
  function showFeedback(result: { correct: boolean; scoreDelta: number }) {
    setFeedback({ ...result, id: ++feedbackId.current });
  }
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const remaining = state
    ? Math.max(0, Math.ceil((Date.parse(state.attempt.ends_at) - now) / 1000))
    : 0;
  async function markComplete() {
    if (completion.current.done || completion.current.started) return;
    const tracker = completion.current;
    const run = generation.current;
    tracker.started = true;
    setCompleting(true);
    try {
      if (blockId) {
        await api(`/learning-modules/blocks/${blockId}/complete`, {
          method: "POST",
        });
        void client.invalidateQueries({ queryKey: ["lesson"] });
      }
      tracker.done = true;
      void client.invalidateQueries({ queryKey: ["plan"] });
    } catch (cause) {
      if (generation.current === run) setError(cause);
    } finally {
      tracker.started = false;
      if (generation.current === run) setCompleting(false);
    }
  }
  const notifyComplete = useEffectEvent(() => {
    void markComplete();
  });
  useEffect(() => {
    if (state?.isCompleted && pending === 0) notifyComplete();
  }, [state?.isCompleted, pending]);
  async function expire() {
    if (!latest.current || latest.current.isCompleted || expiry.current) return;
    if (Date.now() < nextExpiryPoll.current) return;
    expiry.current = true;
    const run = generation.current;
    try {
      if (preparedRef.current) {
        const completed = expireLocalSkillTrainerSession(latest.current);
        await markComplete();
        if (generation.current === run && completion.current.done)
          apply(completed);
      } else {
        await queue.current?.refresh();
        if (generation.current === run && !latest.current?.isCompleted) {
          expiry.current = false;
          nextExpiryPoll.current = Date.now() + 1000;
        }
      }
    } catch (cause) {
      if (generation.current === run) setError(cause);
    }
  }
  const expireOnTimer = useEffectEvent(() => {
    void expire();
  });
  useEffect(() => {
    if (state && !state.isCompleted && remaining === 0) expireOnTimer();
  }, [remaining, state, now]);
  async function start(key: string) {
    if (busyRef.current || (queue.current?.snapshot().pending ?? 0) > 0) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const run = ++generation.current;
    completion.current = { started: false, done: false };
    expiry.current = false;
    discardedFailed.current = false;
    nextExpiryPoll.current = 0;
    setCompleting(false);
    setLocalReview([]);
    setFeedback(null);
    itemScore.current = 0;
    try {
      await queue.current?.stop();
      queue.current = null;
      if (blockId) {
        const p = await api<PreparedTrainer>(
          `/learning-modules/blocks/${blockId}/skill-trainer-session`,
        );
        preparedRef.current = p;
        setPrepared(p);
        const started = Date.now();
        apply({
          ...p.session,
          attempt: {
            ...p.session.attempt,
            started_at: new Date(started).toISOString(),
            current_item_started_at: new Date(started).toISOString(),
            ends_at: new Date(
              started +
                p.session.attempt.config_snapshot.time_limit_seconds * 1000,
            ).toISOString(),
            completed_at: null,
          },
          currentItem: p.items[0] ?? null,
          nextItem: p.items[1] ?? null,
          isCompleted: false,
          isExpired: false,
        });
      } else {
        preparedRef.current = null;
        setPrepared(null);
        const result = await api<{ attempt: SkillTrainerAttemptState }>(
          "/skill-trainer-attempts",
          {
            method: "POST",
            body: { trainerKey: key, studyPlanTaskId: taskId ?? null },
          },
        );
        apply(result.attempt);
        setQueueReady(true);
        const id = result.attempt.attempt.id;
        queue.current = createTrainerActionQueue(result.attempt, {
          uuid: randomUUID,
          send: async (entry) =>
            (
              await api<{ attempt: SkillTrainerAttemptState }>(
                `/skill-trainer-attempts/${id}/actions`,
                {
                  method: "POST",
                  body: {
                    actionId: entry.actionId,
                    expectedVersion: entry.expectedVersion,
                    action: entry.action,
                  },
                },
              )
            ).attempt,
          refresh: async () =>
            (
              await api<{ attempt: SkillTrainerAttemptState }>(
                `/skill-trainer-attempts/${id}`,
              )
            ).attempt,
          isConflict: (cause) =>
            cause instanceof ApiError && cause.status === 409,
          onFeedback: showFeedback,
          onChange: (snapshot) => {
            if (generation.current !== run) return;
            apply(snapshot.state);
            setPending(snapshot.pending);
            setQueueReady(snapshot.canSubmit);
            setError(snapshot.error);
          },
        });
      }
      setNow(Date.now());
    } catch (cause) {
      setError(cause);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function submit(action: SubmitActionPayload) {
    const current = latest.current;
    if (
      !current ||
      busyRef.current ||
      current.isCompleted ||
      Date.now() >= Date.parse(current.attempt.ends_at)
    )
      return false;
    if (!preparedRef.current) return queue.current?.submit(action) ?? false;
    const next = submitLocalSkillTrainerAction(
      current,
      current.attempt.config_snapshot.trainer_key,
      action,
      new Map(preparedRef.current.items.map((item) => [item.id, item])),
      { completeOnQueueEnd: false },
    );
    if (next === current) return false;
    showFeedback({
      correct: next.attempt.streak_count > current.attempt.streak_count,
      scoreDelta: next.attempt.score - current.attempt.score,
    });
    if (
      current.currentItem &&
      next.attempt.current_item_index !== current.attempt.current_item_index
    ) {
      const item = current.currentItem;
      const score = next.attempt.score - itemScore.current;
      itemScore.current = next.attempt.score;
      setLocalReview((rows) => [
        ...rows,
        {
          id: `${item.id}-${current.attempt.current_item_index}`,
          content: item.content,
          answer:
            "answer" in action
              ? action.answer
              : "sequence" in action
                ? action.sequence
                : action.type,
          correct: score > 0,
          score_delta: score,
          elapsed_seconds: current.attempt.current_item_started_at
            ? Math.max(
                0,
                (Date.now() -
                  Date.parse(current.attempt.current_item_started_at)) /
                  1000,
              )
            : null,
        },
      ]);
    }
    apply(next);
    return true;
  }
  async function retry() {
    if (discardedFailed.current) {
      await discard();
      return;
    }
    setError(null);
    try {
      if (queue.current) await queue.current.retry();
      if (latest.current?.isCompleted) await markComplete();
      else if (
        latest.current &&
        Date.now() >= Date.parse(latest.current.attempt.ends_at)
      ) {
        expiry.current = false;
        await expire();
      }
    } catch (cause) {
      setError(cause);
    }
  }
  function reset() {
    if ((queue.current?.snapshot().pending ?? 0) > 0) {
      setError(
        new Error(
          "Your answers are still saving. Retry saving before leaving.",
        ),
      );
      return;
    }
    generation.current++;
    queue.current = null;
    preparedRef.current = null;
    apply(null);
    setPrepared(null);
    setLocalReview([]);
    setFeedback(null);
    setError(null);
    setPending(0);
  }
  async function discard() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    discardedFailed.current = false;
    try {
      await queue.current?.stop();
      if (latest.current && !preparedRef.current)
        await api(`/skill-trainer-attempts/${latest.current.attempt.id}`, {
          method: "DELETE",
        });
      generation.current++;
      queue.current = null;
      preparedRef.current = null;
      apply(null);
      setPrepared(null);
      setLocalReview([]);
      setPending(0);
      setError(null);
    } catch (cause) {
      discardedFailed.current = true;
      setError(cause);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const canSubmit = Boolean(
    state?.currentItem &&
      !state.isCompleted &&
      !busy &&
      !error &&
      remaining > 0 &&
      (prepared || queueReady),
  );
  return {
    state,
    prepared,
    localReview,
    remaining,
    busy,
    pending,
    completing,
    error,
    canSubmit,
    feedback,
    start,
    submit,
    retry,
    discard,
    reset,
  };
}
