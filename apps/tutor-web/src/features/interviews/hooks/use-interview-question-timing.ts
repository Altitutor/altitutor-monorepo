"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { InterviewCommand, InterviewRound, InterviewStationAttempt } from "@altitutor/shared";
import { randomUuid } from "@altitutor/ui/lib/random-uuid";
import { sendInterviewCommand } from "../api/interviews";
import { interviewKeys } from "./use-interviews";

type Selection = Extract<InterviewCommand, { type: "selectQuestion" }>;

/** Serialise navigation separately from assessment saves; retry the same intent ID. */
export function useInterviewQuestionTiming(
  round: InterviewRound,
  attempt: InterviewStationAttempt | undefined,
) {
  const client = useQueryClient();
  const current = useRef({ round, attempt });
  current.current = { round, attempt };
  const queue = useRef<Selection[]>([]);
  const running = useRef(false);
  const scope = useRef(attempt?.id);
  const intended = useRef(attempt?.selectedQuestionId);
  const mounted = useRef(true);
  const [timingError, setTimingError] = useState<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (scope.current === attempt?.id && round.phase === "questions") return;
    scope.current = attempt?.id;
    intended.current = attempt?.selectedQuestionId;
    queue.current = [];
    setTimingError(null);
  }, [attempt?.id, attempt?.selectedQuestionId, round.phase]);

  const drain = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      while (queue.current.length) {
        const command = queue.current[0];
        try {
          await sendInterviewCommand(command);
          if (queue.current[0] === command) queue.current.shift();
          if (mounted.current && scope.current === command.attemptId) setTimingError(null);
          void client.invalidateQueries({ queryKey: interviewKeys.round(command.roundId) });
        } catch (error) {
          if (queue.current[0] !== command) continue;
          const latest = current.current;
          // A group action can close answering while this selection is in flight.
          if (
            latest.round.id !== command.roundId ||
            latest.round.phase !== "questions" || latest.round.pausedAt ||
            latest.attempt?.id !== command.attemptId
          ) {
            queue.current = [];
            intended.current = latest.attempt?.selectedQuestionId;
            if (mounted.current) setTimingError(null);
            break;
          }
          if (mounted.current && scope.current === command.attemptId)
            setTimingError(error instanceof Error ? error.message : "Question timing could not save. Retry when connected.");
          break;
        }
      }
    } finally { running.current = false; }
  }, [client]);

  const onQuestionSelected = useCallback((questionId: string) => {
    const { round: active, attempt: target } = current.current;
    if (!target || active.phase !== "questions" || active.pausedAt) return;
    if (scope.current !== target.id) {
      scope.current = target.id;
      intended.current = target.selectedQuestionId;
      queue.current = [];
      setTimingError(null);
    }
    if (intended.current === questionId) return;
    intended.current = questionId;
    queue.current.push({ type: "selectQuestion", commandId: randomUuid(), roundId: active.id, attemptId: target.id, questionId });
    void drain();
  }, [drain]);

  return { onQuestionSelected, timingError, retryTiming: drain };
}
