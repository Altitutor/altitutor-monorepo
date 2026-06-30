"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalculatorMathsTrainer,
  FindConceptTrainer,
  FindWordTrainer,
  MentalMathsTrainer,
  NumpadTrainer,
  QuickSyllogismTrainer,
} from "@altitutor/ui";
import { isUcatSkillTrainerKey, trainerKeyToSlug } from "@altitutor/shared";
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

const LEAVE_MESSAGE =
  "Leave this skill trainer? Your timed run will keep going in the background.";

function useAttemptTimer(state: SkillTrainerAttemptState | null, onExpire: () => void) {
  const [remaining, setRemaining] = useState(state?.remainingSeconds ?? 0);

  useEffect(() => {
    if (!state) return;
    setRemaining(state.remainingSeconds);
    if (state.isCompleted) return;

    const interval = window.setInterval(() => {
      setRemaining((prev) => {
        const next = Math.max(0, prev - 1);
        if (next === 0) onExpire();
        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [state, onExpire]);

  return remaining;
}

type ActionFeedback = "correct" | "incorrect";

function useActionFeedback() {
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const clearFeedbackTimeoutRef = useRef<number | null>(null);

  const showFeedback = useCallback((nextFeedback: ActionFeedback) => {
    if (clearFeedbackTimeoutRef.current != null) {
      window.clearTimeout(clearFeedbackTimeoutRef.current);
    }
    setFeedback(nextFeedback);
    clearFeedbackTimeoutRef.current = window.setTimeout(() => {
      setFeedback(null);
      clearFeedbackTimeoutRef.current = null;
    }, 600);
  }, []);

  const trackResult = useCallback((state: SkillTrainerAttemptState, prev: SkillTrainerAttemptState) => {
    const delta = state.attempt.score - prev.attempt.score;
    if (delta > 0) {
      showFeedback("correct");
    } else if (delta < 0) {
      showFeedback("incorrect");
    }
  }, [showFeedback]);

  useEffect(() => {
    return () => {
      if (clearFeedbackTimeoutRef.current != null) {
        window.clearTimeout(clearFeedbackTimeoutRef.current);
      }
    };
  }, []);

  return { feedback, showFeedback, trackResult };
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
      const keyword = content?.keywords.find((k) => k.id === payload.keyword_id);
      return keyword?.target_sentence_index === payload.sentence_index
        ? "correct"
        : "incorrect";
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
      if (payload.type === "submit_concept") {
        return foundIndexes.length === (content.occurrences ?? []).length
          ? "correct"
          : "incorrect";
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
      if (!keyword || keyword.target_sentence_index !== payload.sentence_index) return false;
      const placedIds =
        state.attempt.progress?.type === "find_word"
          ? state.attempt.progress.placed_keyword_ids
          : [];
      const nextPlacedIds = new Set([...placedIds, payload.keyword_id]);
      return nextPlacedIds.size >= content.keywords.length;
    }
    case "find_concept": {
      if (payload.type !== "submit_concept") return false;
      const content = asFindConceptContent(state.currentItem?.content);
      if (!content) return false;
      const foundIndexes =
        state.attempt.progress?.type === "find_concept"
          ? state.attempt.progress.found_occurrence_indexes
          : [];
      return foundIndexes.length === (content.occurrences ?? []).length;
    }
    case "quick_syllogism": {
      if (payload.type !== "syllogism_answer") return false;
      const content = asQuickSyllogismContent(state.currentItem?.content);
      return Boolean(content && payload.answer === content.answer);
    }
    case "mental_maths":
      return payload.type === "numeric_answer";
    case "numpad_speed": {
      if (payload.type !== "numpad_sequence") return false;
      const content = asNumpadSpeedContent(state.currentItem?.content);
      if (!content) return false;
      const expected = content.button_sequence.filter((btn) => btn !== "=");
      const submitted = payload.sequence.filter((btn) => btn !== "=");
      return (
        submitted.length === expected.length &&
        submitted.every((btn, index) => btn === expected[index])
      );
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
  onComplete,
}: {
  trainerKey: UcatSkillTrainerKey;
  attemptId: string;
  /** In-lesson embed: skip shell chrome and call onComplete when finished. */
  embedded?: boolean;
  onComplete?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const slug = trainerKeyToSlug(trainerKey);
  const [state, setState] = useState<SkillTrainerAttemptState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [numericInput, setNumericInput] = useState("");
  const [numpadInput, setNumpadInput] = useState<string[]>([]);
  const [calcEngine] = useState(() => createCalculatorEngine());
  const [calcDisplay, setCalcDisplay] = useState("0");
  const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(null);
  const [draggingKeywordId, setDraggingKeywordId] = useState<string | null>(null);
  const [answerFocus, setAnswerFocus] = useState(false);
  const [actionInFlight, setActionInFlight] = useState(false);
  const [optimisticAdvanced, setOptimisticAdvanced] = useState(false);
  const actionInFlightRef = useRef(false);
  const numpadInputRef = useRef<string[]>([]);
  const sidebarOverride = useSidebarOverride();
  const {
    setLocal: setActiveSkillTrainerAttempt,
    clearLocal: clearActiveSkillTrainerAttempt,
  } = useActiveSkillTrainerAttempt();
  const { feedback, showFeedback, trackResult } = useActionFeedback();
  const inProgress = Boolean(state && !state.isCompleted && !embedded);
  const { allowLeave } = useLeaveGuard(inProgress, LEAVE_MESSAGE);

  const refresh = useCallback(async () => {
    const next = await skillTrainerApi.getAttempt(attemptId);
    setState(next);
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
    clearActiveSkillTrainerAttempt,
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
    void refresh();
  }, [refresh]);

  const remaining = useAttemptTimer(state, onExpire);

  const resetActionInputs = useCallback(() => {
    setNumericInput("");
    setNumpadInput([]);
    numpadInputRef.current = [];
    setSelectedKeywordId(null);
    calcEngine.reset();
    setCalcDisplay("0");
  }, [calcEngine]);

  const submit = useCallback(
    async (payload: SubmitActionPayload) => {
      if (!state || actionInFlightRef.current) return;
      actionInFlightRef.current = true;
      setActionInFlight(true);
      setOptimisticAdvanced(false);
      setActionError(null);
      resetActionInputs();
      const prev = state;
      const localFeedback = getLocalActionFeedback(trainerKey, state, payload);
      if (localFeedback) {
        showFeedback(localFeedback);
      }
      const optimisticNext =
        isItemCompletingAction(trainerKey, state, payload) && state.nextItem
          ? advanceToPrefetchedItem(state)
          : null;
      if (optimisticNext) {
        setState(optimisticNext);
        setOptimisticAdvanced(true);
      }
      try {
        const next = await skillTrainerApi.submitAction(attemptId, payload);
        if (!localFeedback) {
          trackResult(next, prev);
        }
        setState(next);
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
        if (optimisticNext) {
          setState(prev);
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
      clearActiveSkillTrainerAttempt,
      queryClient,
      resetActionInputs,
      setActiveSkillTrainerAttempt,
      showFeedback,
      state,
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
  const calculatorMathsContent = asCalculatorMathsContent(state?.currentItem?.content);
  const activeTrainerKey =
    state?.attempt.config_snapshot.trainer_key ??
    (state?.attempt.trainer_key && isUcatSkillTrainerKey(state.attempt.trainer_key)
      ? state.attempt.trainer_key
      : null);
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
    if (state?.isCompleted) {
      void refresh();
      if (embedded) {
        onComplete?.();
      }
    }
  }, [state?.isCompleted, refresh, embedded, onComplete]);

  useEffect(() => {
    if (!state || !trainerMismatch || embedded || !activeTrainerKey) return;
    router.replace(
      `/skill-trainer/${trainerKeyToSlug(activeTrainerKey)}/play?attemptId=${attemptId}`,
    );
  }, [activeTrainerKey, attemptId, embedded, router, state, trainerMismatch]);

  useEffect(() => {
    setAnswerFocus(false);
    setNumericInput("");
    setNumpadInput([]);
    numpadInputRef.current = [];
    setSelectedKeywordId(null);
    calcEngine.reset();
    setCalcDisplay("0");
  }, [currentItemId, calcEngine]);

  const submitNumpadSequence = useCallback(() => {
    void submit({ type: "numpad_sequence", sequence: [...numpadInputRef.current] });
  }, [submit]);

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

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!state) return <p className="text-sm text-destructive">Attempt not found.</p>;
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
        <div className="space-y-3 p-4 text-center">
          <p className="text-lg font-semibold">Skill trainer complete</p>
          <p className="text-sm text-muted-foreground">
            Final score: {state.attempt.score}
          </p>
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
    <div className="space-y-4">
      <SkillTrainerScoreBar
        remaining={remaining}
        score={score}
        streak={streak}
        streakEnabled={state.attempt.config_snapshot.streak_enabled}
        feedback={feedback}
        onExit={handleExit}
      />

      {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}

      {!hasRenderableContent ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          This trainer item could not be loaded. Exit and start a new trainer run.
        </div>
      ) : null}

      {trainerKey === "find_word" && findWordContent ? (
        <FindWordTrainer
          content={findWordContent}
          placedIds={
            state.attempt.progress?.type === "find_word"
              ? state.attempt.progress.placed_keyword_ids
              : []
          }
          selectedKeywordId={selectedKeywordId}
          draggingKeywordId={draggingKeywordId}
          onSelectKeyword={setSelectedKeywordId}
          onDragKeyword={setDraggingKeywordId}
          disabled={disabled}
          onPlace={(keywordId, sentenceIndex) =>
            void submit({ type: "place_word", keyword_id: keywordId, sentence_index: sentenceIndex })
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
          onSubmit={() => void submit({ type: "submit_concept" })}
        />
      ) : null}

      {trainerKey === "quick_syllogism" && syllogismContent ? (
        <QuickSyllogismTrainer
          content={syllogismContent}
          disabled={disabled}
          onAnswer={(answer) => void submit({ type: "syllogism_answer", answer })}
        />
      ) : null}

      {trainerKey === "mental_maths" && mentalMathsContent ? (
        <MentalMathsTrainer
          content={mentalMathsContent}
          value={numericInput}
          inputKey={currentItemId ?? "mental"}
          onChange={setNumericInput}
          disabled={disabled}
          onSubmit={() => {
            const n = Number(numericInput);
            if (Number.isNaN(n) || numericInput.trim() === "") return;
            void submit({ type: "numeric_answer", answer: n });
          }}
        />
      ) : null}

      {trainerKey === "numpad_speed" && numpadContent ? (
        <NumpadTrainer
          content={numpadContent}
          sequence={numpadInput}
          onCalcKey={(key) => {
            if (key === "=") {
              submitNumpadSequence();
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
          onSubmit={submitNumpadSequence}
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
          onSubmit={() => {
            const n = Number(numericInput);
            if (Number.isNaN(n) || numericInput.trim() === "") return;
            void submit({ type: "numeric_answer", answer: n });
          }}
          RichContent={RichContentBlock}
        />
      ) : null}
    </div>
  );
}
