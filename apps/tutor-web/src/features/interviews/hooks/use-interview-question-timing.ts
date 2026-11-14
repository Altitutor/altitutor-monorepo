"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { InterviewCommand, InterviewRound, InterviewStationAttempt } from "@altitutor/shared";
import { randomUuid } from "@altitutor/ui/lib/random-uuid";
import { sendInterviewCommand } from "../api/interviews";
import { interviewKeys } from "./use-interviews";

type Selection = Extract<InterviewCommand, { type: "selectQuestion" }>;

function questionTimingClosed(error: unknown) {
  return error instanceof Error && "status" in error && error.status === 400 &&
    (error.message === "Questions are not active for this station" ||
      error.message === "Question time has ended");
}

/** Serialise navigation separately from assessment saves; retry the same intent ID. */
export function useInterviewQuestionTiming(
  round: InterviewRound,
  attempt: InterviewStationAttempt | undefined,
) {
  const client = useQueryClient();
  const progress = attempt && round.progress.find(
    (item) => item.stationId === attempt.stationId && item.studentId === attempt.studentId,
  );
  const active = round.phase === "questions" && !round.pausedAt &&
    !!progress && !progress.endedEarly && !progress.feedbackComplete;
  const current = useRef({ roundId: round.id, version: round.version, attempt, active });
  current.current = { roundId: round.id, version: round.version, attempt, active };
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
    if (scope.current === attempt?.id && active) return;
    scope.current = attempt?.id;
    intended.current = attempt?.selectedQuestionId;
    queue.current = [];
    setTimingError(null);
  }, [active, attempt?.id, attempt?.selectedQuestionId]);

  const drain = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      while (queue.current.length) {
        const command = queue.current[0];
        const versionAtSend = current.current.version;
        try {
          await sendInterviewCommand(command);
          if (queue.current[0] === command) queue.current.shift();
          if (mounted.current && scope.current === command.attemptId) setTimingError(null);
          void client.invalidateQueries({ queryKey: interviewKeys.round(command.roundId) });
        } catch (error) {
          if (queue.current[0] !== command) continue;
          const latestRound = current.current;
          // A group action can close answering before its effects clear the queue.
          if (!latestRound.active || latestRound.roundId !== command.roundId ||
            latestRound.attempt?.id !== command.attemptId) {
            queue.current = [];
            intended.current = latestRound.attempt?.selectedQuestionId;
            if (mounted.current) setTimingError(null);
            if (questionTimingClosed(error))
              void client.invalidateQueries({ queryKey: interviewKeys.round(command.roundId) });
            break;
          }
          // A selection can arrive after the server closes the answering interval.
          if (questionTimingClosed(error)) {
            const latestSelection = queue.current.at(-1);
            queue.current = [];
            intended.current = latestRound.attempt?.selectedQuestionId;
            if (mounted.current) setTimingError(null);
            void client.invalidateQueries({ queryKey: interviewKeys.round(command.roundId) });
            // A newer active snapshot can arrive before the closed response.
            if (mounted.current && latestRound.active && latestRound.version > versionAtSend &&
              latestRound.attempt?.id === command.attemptId &&
              latestSelection && latestSelection.questionId !== intended.current) {
              intended.current = latestSelection.questionId;
              queue.current.push({ ...latestSelection, commandId: randomUuid() });
              continue;
            }
          } else if (mounted.current && scope.current === command.attemptId) {
            setTimingError(error instanceof Error ? error.message : "Question timing could not save. Retry when connected.");
          }
          break;
        }
      }
    } finally { running.current = false; }
  }, [client]);

  const onQuestionSelected = useCallback((questionId: string) => {
    const { roundId, attempt: target, active } = current.current;
    if (!target || !active) return;
    if (scope.current !== target.id) {
      scope.current = target.id;
      intended.current = target.selectedQuestionId;
      queue.current = [];
      setTimingError(null);
    }
    if (intended.current === questionId) return;
    intended.current = questionId;
    queue.current.push({ type: "selectQuestion", commandId: randomUuid(), roundId, attemptId: target.id, questionId });
    void drain();
  }, [drain]);

  return { onQuestionSelected, timingError, retryTiming: drain };
}
