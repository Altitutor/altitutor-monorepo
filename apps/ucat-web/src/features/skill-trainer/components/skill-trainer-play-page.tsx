"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import {
  CalculatorMathsTrainer,
  FindConceptTrainer,
  FindWordTrainer,
  MentalMathsTrainer,
  NumpadTrainer,
  QuickSyllogismTrainer,
} from "@altitutor/ui";
import { Button, Skeleton } from "@altitutor/ui";
import { isUcatSkillTrainerKey, trainerKeyToSlug } from "@altitutor/shared";
import {
  extractSkillTrainerPlainText,
  findFindWordKeywordOccurrences,
} from "@altitutor/shared";
import type { UcatSkillTrainerKey } from "@altitutor/shared";
import { RichContentBlock } from "@/features/question-engine/components/rich-content-block";
import { useSidebarOverride } from "@/features/layout/context/sidebar-override-context";
import { useActiveSkillTrainerAttempt } from "@/features/skill-trainer/context/active-skill-trainer-attempt-context";
import { skillTrainerApi } from "@/features/skill-trainer/api/skill-trainer-api";
import type {
  SkillTrainerAttemptState,
  SubmitActionPayload,
} from "@/features/skill-trainer/types/attempt";
import {
  asCalculatorMathsContent,
  asFindConceptContent,
  asFindWordContent,
  asMentalMathsContent,
  asNumpadSpeedContent,
  asQuickSyllogismContent,
} from "@/features/skill-trainer/lib/content-guards";
import { useLeaveGuard } from "@/features/skill-trainer/hooks/use-leave-guard";
import { createCalculatorEngine } from "@/features/skill-trainer/lib/calculator-engine";
import { SkillTrainerCompleteScreen } from "@/features/skill-trainer/components/skill-trainer-complete-screen";
import { SkillTrainerScoreBar } from "@/features/skill-trainer/components/skill-trainer-score-bar";
import {
  expireLocalSkillTrainerSession,
  submitLocalSkillTrainerAction,
} from "@/features/skill-trainer/lib/local-session";
import { ScoreBarFeedback } from "@/features/skill-trainer/components/score-bar-feedback";

const LEAVE_MESSAGE =
  "Leave this skill trainer? Your timed run will keep going in the background.";

function getAttemptRemainingSeconds(state: SkillTrainerAttemptState): number {
  const endsAtMs = Date.parse(state.attempt.ends_at);
  if (Number.isNaN(endsAtMs)) return state.remainingSeconds;
  return Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000));
}

function useAttemptTimer(
  state: SkillTrainerAttemptState | null,
  onExpire: () => void,
) {
  const [remaining, setRemaining] = useState(state?.remainingSeconds ?? 0);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!state) return;
    expiredRef.current = false;
    setRemaining(
      state.isCompleted
        ? state.remainingSeconds
        : getAttemptRemainingSeconds(state),
    );
    if (state.isCompleted) {
      expiredRef.current = true;
      return;
    }

    const interval = window.setInterval(() => {
      const next = getAttemptRemainingSeconds(state);
      setRemaining(next);
      if (next === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [state, onExpire]);

  return remaining;
}

type ActionFeedback = "correct" | "incorrect";
type FeedbackOrigin = { id: number; x: number; y: number };
type FeedbackOriginInput = { x: number; y: number };

function useActionFeedback() {
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [feedbackOrigin, setFeedbackOrigin] = useState<FeedbackOrigin | null>(
    null,
  );
  const [scoreDelta, setScoreDelta] = useState<{
    id: number;
    value: number;
  } | null>(null);
  const clearFeedbackTimeoutRef = useRef<number | null>(null);
  const clearScoreDeltaTimeoutRef = useRef<number | null>(null);
  const feedbackOriginIdRef = useRef(0);
  const scoreDeltaIdRef = useRef(0);

  const showFeedback = useCallback(
    (
      nextFeedback: ActionFeedback,
      origin?: { x: number; y: number } | null,
    ) => {
      if (clearFeedbackTimeoutRef.current != null) {
        window.clearTimeout(clearFeedbackTimeoutRef.current);
      }
      feedbackOriginIdRef.current += 1;
      setFeedback(nextFeedback);
      setFeedbackOrigin({
        id: feedbackOriginIdRef.current,
        x: origin?.x ?? Math.round(window.innerWidth / 2),
        y: origin?.y ?? Math.round(window.innerHeight * 0.42),
      });
      clearFeedbackTimeoutRef.current = window.setTimeout(() => {
        setFeedback(null);
        setFeedbackOrigin(null);
        clearFeedbackTimeoutRef.current = null;
      }, 600);
    },
    [],
  );

  const showScoreDelta = useCallback((value: number) => {
    if (value === 0) return;
    if (clearScoreDeltaTimeoutRef.current != null) {
      window.clearTimeout(clearScoreDeltaTimeoutRef.current);
    }
    scoreDeltaIdRef.current += 1;
    setScoreDelta({ id: scoreDeltaIdRef.current, value });
    clearScoreDeltaTimeoutRef.current = window.setTimeout(() => {
      setScoreDelta(null);
      clearScoreDeltaTimeoutRef.current = null;
    }, 900);
  }, []);

  const trackResult = useCallback(
    (
      state: SkillTrainerAttemptState,
      prev: SkillTrainerAttemptState,
      fallbackKind?: ActionFeedback | null,
      origin?: { x: number; y: number } | null,
    ) => {
      const delta = state.attempt.score - prev.attempt.score;
      if (delta !== 0) {
        showScoreDelta(delta);
        if (!fallbackKind) {
          showFeedback(delta > 0 ? "correct" : "incorrect", origin);
        }
      } else if (fallbackKind) {
        showFeedback(fallbackKind, origin);
      }
    },
    [showFeedback, showScoreDelta],
  );

  useEffect(() => {
    return () => {
      if (clearFeedbackTimeoutRef.current != null) {
        window.clearTimeout(clearFeedbackTimeoutRef.current);
      }
      if (clearScoreDeltaTimeoutRef.current != null) {
        window.clearTimeout(clearScoreDeltaTimeoutRef.current);
      }
    };
  }, []);

  return { feedback, feedbackOrigin, scoreDelta, showFeedback, trackResult };
}

function getLocalActionFeedback(
  trainerKey: UcatSkillTrainerKey,
  state: SkillTrainerAttemptState,
  payload: SubmitActionPayload,
): ActionFeedback | null {
  switch (trainerKey) {
    case "find_word": {
      if (payload.type !== "place_word") return null;
      const content = asFindWordContent(state.currentItem?.content);
      const keyword = content?.keywords.find(
        (k) => k.id === payload.keyword_id,
      );
      if (!content || !keyword) return "incorrect";
      const plain = extractSkillTrainerPlainText(content.passage, {
        blockSeparator: "\n",
      });
      const validTarget = findFindWordKeywordOccurrences(plain, keyword).some(
        (occurrence) =>
          payload.character_index >= occurrence.start &&
          payload.character_index < occurrence.end,
      );
      return validTarget ? "correct" : "incorrect";
    }
    case "find_concept": {
      const content = asFindConceptContent(state.currentItem?.content);
      if (!content) return null;
      const foundIndexes =
        state.attempt.progress?.type === "find_concept"
          ? state.attempt.progress.found_occurrence_indexes
          : [];
      if (payload.type === "click_occurrence") {
        const valid =
          payload.occurrence_index >= 0 &&
          payload.occurrence_index < (content.occurrences ?? []).length &&
          !foundIndexes.includes(payload.occurrence_index);
        return valid ? "correct" : "incorrect";
      }
      if (payload.type === "skip_concept") {
        return "incorrect";
      }
      return null;
    }
    case "quick_syllogism": {
      if (payload.type !== "syllogism_answer") return null;
      const content = asQuickSyllogismContent(state.currentItem?.content);
      if (!content) return null;
      return payload.answer === content.answer ? "correct" : "incorrect";
    }
    case "mental_maths": {
      if (payload.type !== "numeric_answer") return null;
      const content = asMentalMathsContent(state.currentItem?.content);
      if (!content) return null;
      return Math.abs(payload.answer - content.answer) < 0.001
        ? "correct"
        : "incorrect";
    }
    case "numpad_speed": {
      if (payload.type !== "numpad_sequence") return null;
      const content = asNumpadSpeedContent(state.currentItem?.content);
      if (!content) return null;
      const expected = content.button_sequence.filter((btn) => btn !== "=");
      const submitted = payload.sequence.filter((btn) => btn !== "=");
      const correct =
        submitted.length === expected.length &&
        submitted.every((btn, index) => btn === expected[index]);
      return correct ? "correct" : "incorrect";
    }
    case "calculator_maths": {
      if (payload.type !== "numeric_answer") return null;
      const content = asCalculatorMathsContent(state.currentItem?.content);
      if (!content) return null;
      return Math.abs(payload.answer - content.answer) < 0.001
        ? "correct"
        : "incorrect";
    }
  }
}

function isItemCompletingAction(
  trainerKey: UcatSkillTrainerKey,
  state: SkillTrainerAttemptState,
  payload: SubmitActionPayload,
): boolean {
  switch (trainerKey) {
    case "find_word": {
      if (payload.type !== "place_word") return false;
      const content = asFindWordContent(state.currentItem?.content);
      if (!content) return false;
      const keyword = content.keywords.find((k) => k.id === payload.keyword_id);
      if (!keyword) return false;
      const plain = extractSkillTrainerPlainText(content.passage, {
        blockSeparator: "\n",
      });
      const validTarget = findFindWordKeywordOccurrences(plain, keyword).some(
        (occurrence) =>
          payload.character_index >= occurrence.start &&
          payload.character_index < occurrence.end,
      );
      if (!validTarget) return false;
      const placedIds =
        state.attempt.progress?.type === "find_word"
          ? state.attempt.progress.placed_keyword_ids
          : [];
      const nextPlacedIds = new Set([...placedIds, payload.keyword_id]);
      return nextPlacedIds.size >= content.keywords.length;
    }
    case "find_concept": {
      if (payload.type === "skip_concept") return true;
      if (payload.type !== "click_occurrence") return false;
      const content = asFindConceptContent(state.currentItem?.content);
      if (!content) return false;
      const foundIndexes =
        state.attempt.progress?.type === "find_concept"
          ? state.attempt.progress.found_occurrence_indexes
          : [];
      const occurrences = content.occurrences ?? [];
      const valid =
        payload.occurrence_index >= 0 &&
        payload.occurrence_index < occurrences.length &&
        !foundIndexes.includes(payload.occurrence_index);
      if (!valid) return false;
      return (
        new Set([...foundIndexes, payload.occurrence_index]).size >=
        occurrences.length
      );
    }
    case "quick_syllogism": {
      if (payload.type !== "syllogism_answer") return false;
      return Boolean(asQuickSyllogismContent(state.currentItem?.content));
    }
    case "mental_maths":
      return payload.type === "numeric_answer";
    case "numpad_speed": {
      if (payload.type !== "numpad_sequence") return false;
      const content = asNumpadSpeedContent(state.currentItem?.content);
      if (!content) return false;
      const expected = content.button_sequence.filter((btn) => btn !== "=");
      const submitted = payload.sequence.filter((btn) => btn !== "=");
      return submitted.length > 0 || expected.length === 0;
    }
    case "calculator_maths":
      return payload.type === "numeric_answer";
  }
}

function advanceToPrefetchedItem(
  state: SkillTrainerAttemptState,
): SkillTrainerAttemptState | null {
  if (!state.nextItem) return null;
  return {
    ...state,
    attempt: {
      ...state.attempt,
      current_item_index: state.attempt.current_item_index + 1,
      progress: null,
    },
    currentItem: state.nextItem,
    nextItem: null,
  };
}

export function SkillTrainerPlayPage({
  trainerKey,
  attemptId,
  embedded = false,
  initialState,
  localItems,
  onComplete,
  onRestart,
}: {
  trainerKey: UcatSkillTrainerKey;
  attemptId?: string;
  /** In-lesson embed: skip shell chrome and call onComplete when finished. */
  embedded?: boolean;
  initialState?: SkillTrainerAttemptState;
  localItems?: Array<{ id: string; content: Record<string, unknown> }>;
  onComplete?: () => void;
  onRestart?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const slug = trainerKeyToSlug(trainerKey);
  const [state, setState] = useState<SkillTrainerAttemptState | null>(
    initialState ?? null,
  );
  const [loading, setLoading] = useState(initialState == null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [numericInput, setNumericInput] = useState("");
  const [numpadInput, setNumpadInput] = useState<string[]>([]);
  const [calcEngine] = useState(() => createCalculatorEngine());
  const [calcDisplay, setCalcDisplay] = useState("0");
  const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(
    null,
  );
  const [draggingKeywordId, setDraggingKeywordId] = useState<string | null>(
    null,
  );
  const [answerFocus, setAnswerFocus] = useState(false);
  const [actionInFlight, setActionInFlight] = useState(false);
  const [optimisticAdvanced, setOptimisticAdvanced] = useState(false);
  const actionInFlightRef = useRef(false);
  const stateRef = useRef<SkillTrainerAttemptState | null>(
    initialState ?? null,
  );
  const completionNotifiedRef = useRef<string | null>(null);
  const numpadInputRef = useRef<string[]>([]);
  const lastInteractionPointRef = useRef<{ x: number; y: number } | null>(null);
  const sidebarOverride = useSidebarOverride();
  const {
    setLocal: setActiveSkillTrainerAttempt,
    clearLocal: clearActiveSkillTrainerAttempt,
  } = useActiveSkillTrainerAttempt();
  const { feedback, feedbackOrigin, scoreDelta, showFeedback, trackResult } =
    useActionFeedback();
  const localItemsById = useMemo(
    () => new Map((localItems ?? []).map((item) => [item.id, item])),
    [localItems],
  );
  const localMode = initialState != null;
  const inProgress = Boolean(state && !state.isCompleted && !embedded);
  const { allowLeave } = useLeaveGuard(inProgress, LEAVE_MESSAGE);

  const applyState = useCallback((next: SkillTrainerAttemptState | null) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const rememberInteractionPoint = useCallback(
    (event: { clientX: number; clientY: number }) => {
      if (event.clientX === 0 && event.clientY === 0) return;
      lastInteractionPointRef.current = {
        x: Math.round(event.clientX),
        y: Math.round(event.clientY),
      };
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (localMode) {
      if (initialState) {
        setState((current) => {
          const next = current ?? initialState;
          stateRef.current = next;
          return next;
        });
      }
      return initialState;
    }
    if (!attemptId) return null;
    const next = await skillTrainerApi.getAttempt(attemptId);
    applyState(next);
    if (next.isCompleted) {
      clearActiveSkillTrainerAttempt();
      await queryClient.invalidateQueries({
        queryKey: ["skill-trainers", "leaderboard", trainerKey],
      });
    } else {
      setActiveSkillTrainerAttempt(next);
    }
    return next;
  }, [
    attemptId,
    applyState,
    clearActiveSkillTrainerAttempt,
    initialState,
    localMode,
    queryClient,
    setActiveSkillTrainerAttempt,
    trainerKey,
  ]);

  useEffect(() => {
    void (async () => {
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const onExpire = useCallback(() => {
    if (localMode) {
      setState((current) => {
        const next =
          current && !current.isCompleted
            ? expireLocalSkillTrainerSession(current)
            : current;
        stateRef.current = next;
        return next;
      });
      return;
    }
    void refresh();
  }, [localMode, refresh]);

  const remaining = useAttemptTimer(state, onExpire);

  const resetActionInputs = useCallback(
    (options: { keepSelectedKeyword?: boolean } = {}) => {
      setNumericInput("");
      setNumpadInput([]);
      numpadInputRef.current = [];
      if (!options.keepSelectedKeyword) {
        setSelectedKeywordId(null);
      }
      calcEngine.reset();
      setCalcDisplay("0");
    },
    [calcEngine],
  );

  const submit = useCallback(
    async (payload: SubmitActionPayload, origin?: FeedbackOriginInput) => {
      const currentState = stateRef.current;
      if (
        !currentState ||
        currentState.isCompleted ||
        actionInFlightRef.current
      )
        return;
      actionInFlightRef.current = true;
      setActionInFlight(true);
      setOptimisticAdvanced(false);
      setActionError(null);
      const prev = currentState;
      const localFeedback = getLocalActionFeedback(
        trainerKey,
        currentState,
        payload,
      );
      const keepSelectedKeyword =
        trainerKey === "find_word" &&
        payload.type === "place_word" &&
        localFeedback === "incorrect";
      const actionOrigin = origin ?? lastInteractionPointRef.current;
      resetActionInputs({ keepSelectedKeyword });
      if (localFeedback) {
        showFeedback(localFeedback, actionOrigin);
      }
      const optimisticProgressNext =
        !localMode && localFeedback === "correct"
          ? (() => {
              if (trainerKey === "find_word" && payload.type === "place_word") {
                const placed =
                  currentState.attempt.progress?.type === "find_word"
                    ? currentState.attempt.progress.placed_keyword_ids
                    : [];
                return {
                  ...currentState,
                  attempt: {
                    ...currentState.attempt,
                    progress: {
                      type: "find_word" as const,
                      placed_keyword_ids: [
                        ...new Set([...placed, payload.keyword_id]),
                      ],
                    },
                  },
                };
              }
              if (
                trainerKey !== "find_concept" ||
                payload.type !== "click_occurrence"
              ) {
                return null;
              }
              const found =
                currentState.attempt.progress?.type === "find_concept"
                  ? currentState.attempt.progress.found_occurrence_indexes
                  : [];
              return {
                ...currentState,
                attempt: {
                  ...currentState.attempt,
                  progress: {
                    type: "find_concept" as const,
                    found_occurrence_indexes: [
                      ...new Set([...found, payload.occurrence_index]),
                    ],
                  },
                },
              };
            })()
          : null;
      const optimisticNext =
        !localMode &&
        isItemCompletingAction(trainerKey, currentState, payload) &&
        currentState.nextItem
          ? advanceToPrefetchedItem(currentState)
          : null;
      if (optimisticNext) {
        applyState(optimisticNext);
        setOptimisticAdvanced(true);
      } else if (optimisticProgressNext) {
        applyState(optimisticProgressNext);
      }
      try {
        if (localMode) {
          const next = submitLocalSkillTrainerAction(
            prev,
            trainerKey,
            payload,
            localItemsById,
            { completeOnQueueEnd: false },
          );
          trackResult(next, prev, localFeedback, actionOrigin);
          applyState(next);
          return;
        }
        if (!attemptId) throw new Error("Attempt not found");
        const next = await skillTrainerApi.submitAction(attemptId, payload);
        trackResult(next, prev, localFeedback, actionOrigin);
        applyState(next);
        if (next.isCompleted) {
          clearActiveSkillTrainerAttempt();
          await queryClient.invalidateQueries({
            queryKey: ["skill-trainers", "leaderboard", trainerKey],
          });
        } else {
          setActiveSkillTrainerAttempt(next);
        }
        if (next.isCompleted) return;
      } catch (err) {
        if (optimisticNext || optimisticProgressNext) {
          applyState(prev);
        }
        setActionError(err instanceof Error ? err.message : "Action failed");
      } finally {
        actionInFlightRef.current = false;
        setActionInFlight(false);
        setOptimisticAdvanced(false);
      }
    },
    [
      attemptId,
      applyState,
      clearActiveSkillTrainerAttempt,
      localItemsById,
      localMode,
      queryClient,
      resetActionInputs,
      setActiveSkillTrainerAttempt,
      showFeedback,
      trackResult,
      trainerKey,
    ],
  );

  const handleCalcKey = useCallback(
    (key: string) => {
      const next = calcEngine.pressKey(key);
      setCalcDisplay(next.display);
    },
    [calcEngine],
  );

  const currentItemId = state?.currentItem?.id;
  const findWordContent = asFindWordContent(state?.currentItem?.content);
  const findConceptContent = asFindConceptContent(state?.currentItem?.content);
  const syllogismContent = asQuickSyllogismContent(state?.currentItem?.content);
  const mentalMathsContent = asMentalMathsContent(state?.currentItem?.content);
  const numpadContent = asNumpadSpeedContent(state?.currentItem?.content);
  const calculatorMathsContent = asCalculatorMathsContent(
    state?.currentItem?.content,
  );
  const activeTrainerKey =
    state?.attempt.config_snapshot.trainer_key ??
    (state?.attempt.trainer_key &&
    isUcatSkillTrainerKey(state.attempt.trainer_key)
      ? state.attempt.trainer_key
      : null);
  const completedAttemptId = state?.isCompleted ? state.attempt.id : null;
  const trainerMismatch =
    activeTrainerKey != null && activeTrainerKey !== trainerKey;
  const hasRenderableContent =
    (trainerKey === "find_word" && Boolean(findWordContent)) ||
    (trainerKey === "find_concept" && Boolean(findConceptContent)) ||
    (trainerKey === "quick_syllogism" && Boolean(syllogismContent)) ||
    (trainerKey === "mental_maths" && Boolean(mentalMathsContent)) ||
    (trainerKey === "numpad_speed" && Boolean(numpadContent)) ||
    (trainerKey === "calculator_maths" && Boolean(calculatorMathsContent));

  useEffect(() => {
    numpadInputRef.current = numpadInput;
  }, [numpadInput]);

  useEffect(() => {
    if (!sidebarOverride || embedded) return;
    const playing = !state?.isCompleted;
    if (playing) {
      sidebarOverride.setCollapsedOverride(true);
      sidebarOverride.setHideTopBar(true);
    } else {
      sidebarOverride.setCollapsedOverride(null);
      sidebarOverride.setHideTopBar(false);
    }
    return () => {
      sidebarOverride.setCollapsedOverride(null);
      sidebarOverride.setHideTopBar(false);
    };
  }, [sidebarOverride, state?.isCompleted, embedded]);

  useEffect(() => {
    if (completedAttemptId) {
      if (completionNotifiedRef.current === completedAttemptId) return;
      completionNotifiedRef.current = completedAttemptId;
      if (!localMode) {
        void refresh();
      }
      if (embedded || localMode) {
        onComplete?.();
      }
    }
  }, [completedAttemptId, refresh, embedded, localMode, onComplete]);

  useEffect(() => {
    if (!state || !trainerMismatch || embedded || !activeTrainerKey) return;
    router.replace(
      `/skill-trainer/${trainerKeyToSlug(activeTrainerKey)}/play?attemptId=${attemptId}`,
    );
  }, [activeTrainerKey, attemptId, embedded, router, state, trainerMismatch]);

  useEffect(() => {
    setAnswerFocus(trainerKey === "calculator_maths");
    setNumericInput("");
    setNumpadInput([]);
    numpadInputRef.current = [];
    setSelectedKeywordId(null);
    calcEngine.reset();
    setCalcDisplay("0");
  }, [currentItemId, calcEngine, trainerKey]);

  const submitNumpadSequenceFromOrigin = useCallback(
    (origin?: FeedbackOriginInput) => {
      void submit(
        { type: "numpad_sequence", sequence: [...numpadInputRef.current] },
        origin,
      );
    },
    [submit],
  );

  const appendNumpadKey = useCallback((key: string) => {
    setNumpadInput((prev) => {
      const next = [...prev, key];
      numpadInputRef.current = next;
      return next;
    });
  }, []);

  const handleExit = useCallback(() => {
    if (!window.confirm(LEAVE_MESSAGE)) return;
    allowLeave();
    router.push(`/skill-trainer/${slug}`);
  }, [allowLeave, router, slug]);

  if (loading) {
    return (
      <div
        className="space-y-4"
        aria-busy="true"
        aria-label="Loading skill trainer"
      >
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-[30rem] w-full rounded-xl" />
      </div>
    );
  }
  if (!state)
    return <p className="text-sm text-destructive">Attempt not found.</p>;
  if (trainerMismatch) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading the active trainer…
      </p>
    );
  }

  if (state.isCompleted) {
    if (embedded) {
      return (
        <div className="flex min-h-[488px] flex-col gap-4">
          <SkillTrainerScoreBar
            remaining={0}
            score={state.attempt.score}
            streak={state.attempt.streak_count}
            streakEnabled={state.attempt.config_snapshot.streak_enabled}
            scoreDelta={null}
          />
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="space-y-2">
              <p className="text-xl font-semibold">Skill trainer complete</p>
              <p className="text-4xl font-bold tabular-nums">
                {state.attempt.score}
              </p>
              <p className="text-sm text-muted-foreground">Final score</p>
            </div>
            {onRestart ? (
              <Button type="button" className="gap-2" onClick={onRestart}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                Restart
              </Button>
            ) : null}
          </div>
        </div>
      );
    }
    return (
      <SkillTrainerCompleteScreen
        trainerKey={trainerKey}
        finalScore={state.attempt.score}
        onLeave={allowLeave}
      />
    );
  }

  const score = state.attempt.score;
  const streak = state.attempt.streak_count;
  const disabled = actionInFlight && !optimisticAdvanced;

  return (
    <>
      <ScoreBarFeedback feedback={feedback} origin={feedbackOrigin} />
      <div
        className="space-y-4"
        onPointerDownCapture={rememberInteractionPoint}
        onDropCapture={rememberInteractionPoint}
      >
        <div id="tour-skill-trainer-score">
          <SkillTrainerScoreBar
            remaining={remaining}
            score={score}
            streak={streak}
            streakEnabled={state.attempt.config_snapshot.streak_enabled}
            scoreDelta={scoreDelta}
            onExit={embedded ? undefined : handleExit}
          />
        </div>

        {actionError ? (
          <p className="text-sm text-destructive">{actionError}</p>
        ) : null}

        {!hasRenderableContent ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            This trainer item could not be loaded. Exit and start a new trainer
            run.
          </div>
        ) : null}

        <div id="tour-skill-trainer-workspace">
          {trainerKey === "find_word" && findWordContent ? (
            <FindWordTrainer
            content={findWordContent}
            shuffleKey={currentItemId ?? undefined}
            placedIds={
              state.attempt.progress?.type === "find_word"
                ? state.attempt.progress.placed_keyword_ids
                : []
            }
            selectedKeywordId={selectedKeywordId}
            draggingKeywordId={draggingKeywordId}
            onSelectKeyword={setSelectedKeywordId}
            onDragKeyword={setDraggingKeywordId}
            disabled={disabled && trainerKey !== "find_word"}
            onPlace={(keywordId, characterIndex) =>
              void submit({
                type: "place_word",
                keyword_id: keywordId,
                character_index: characterIndex,
              })
            }
            />
          ) : null}

        {trainerKey === "find_concept" && findConceptContent ? (
          <FindConceptTrainer
            content={findConceptContent}
            foundIndexes={
              state.attempt.progress?.type === "find_concept"
                ? state.attempt.progress.found_occurrence_indexes
                : []
            }
            disabled={disabled}
            onClickOccurrence={(index) =>
              void submit({ type: "click_occurrence", occurrence_index: index })
            }
            onSkip={() => void submit({ type: "skip_concept" })}
          />
        ) : null}

        {trainerKey === "quick_syllogism" && syllogismContent ? (
          <QuickSyllogismTrainer
            content={syllogismContent}
            disabled={disabled}
            onAnswer={(answer) =>
              void submit({ type: "syllogism_answer", answer })
            }
          />
        ) : null}

        {trainerKey === "mental_maths" && mentalMathsContent ? (
          <MentalMathsTrainer
            content={mentalMathsContent}
            value={numericInput}
            inputKey={currentItemId ?? "mental"}
            onChange={setNumericInput}
            disabled={disabled}
            onSubmit={(origin) => {
              const n = Number(numericInput);
              if (Number.isNaN(n) || numericInput.trim() === "") return;
              void submit({ type: "numeric_answer", answer: n }, origin);
            }}
          />
        ) : null}

        {trainerKey === "numpad_speed" && numpadContent ? (
          <NumpadTrainer
            content={numpadContent}
            sequence={numpadInput}
            onCalcKey={(key) => {
              if (key === "=") {
                submitNumpadSequenceFromOrigin();
                return;
              }
              appendNumpadKey(key);
            }}
            onRemoveKey={(index) => {
              setNumpadInput((prev) => {
                const next = prev.filter((_, i) => i !== index);
                numpadInputRef.current = next;
                return next;
              });
            }}
            onSubmit={submitNumpadSequenceFromOrigin}
            disabled={disabled}
          />
        ) : null}

        {trainerKey === "calculator_maths" && calculatorMathsContent ? (
          <CalculatorMathsTrainer
            content={calculatorMathsContent}
            value={numericInput}
            calcDisplay={calcDisplay}
            answerFocused={answerFocus}
            onAnswerFocus={() => setAnswerFocus(true)}
            onCalcFocus={() => setAnswerFocus(false)}
            onChange={setNumericInput}
            onCalcKey={handleCalcKey}
            disabled={disabled}
            onSubmit={(origin) => {
              const n = Number(numericInput);
              if (Number.isNaN(n) || numericInput.trim() === "") return;
              void submit({ type: "numeric_answer", answer: n }, origin);
            }}
            RichContent={RichContentBlock}
          />
        ) : null}
        </div>
      </div>
    </>
  );
}
