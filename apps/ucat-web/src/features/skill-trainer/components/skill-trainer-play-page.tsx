"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import type { SkillTrainerAttemptState } from "@/features/skill-trainer/types/attempt";
import {
  asCalculatorMathsContent,
  asFindConceptContent,
  asFindWordContent,
  asMentalMathsContent,
  asNumpadSpeedContent,
  asQuickSyllogismContent,
} from "@/features/skill-trainer/lib/content-guards";
import { useCooldownActive } from "@/features/skill-trainer/hooks/use-cooldown-active";
import { useLeaveGuard } from "@/features/skill-trainer/hooks/use-leave-guard";
import { createCalculatorEngine } from "@/features/skill-trainer/lib/calculator-engine";
import { CooldownOverlay } from "@/features/skill-trainer/components/cooldown-overlay";
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

function useActionFeedback() {
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);

  const trackResult = useCallback((state: SkillTrainerAttemptState, prev: SkillTrainerAttemptState) => {
    const delta = state.attempt.score - prev.attempt.score;
    if (delta > 0) {
      setFeedback("correct");
    } else if (delta < 0) {
      setFeedback("incorrect");
    }
    window.setTimeout(() => setFeedback(null), 600);
  }, []);

  return { feedback, trackResult };
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
  const actionInFlightRef = useRef(false);
  const numpadInputRef = useRef<string[]>([]);
  const sidebarOverride = useSidebarOverride();
  const {
    setLocal: setActiveSkillTrainerAttempt,
    clearLocal: clearActiveSkillTrainerAttempt,
  } = useActiveSkillTrainerAttempt();
  const { feedback, trackResult } = useActionFeedback();
  const inProgress = Boolean(state && !state.isCompleted && !embedded);
  const { allowLeave } = useLeaveGuard(inProgress, LEAVE_MESSAGE);

  const refresh = useCallback(async () => {
    const next = await skillTrainerApi.getAttempt(attemptId);
    setState(next);
    if (next.isCompleted) {
      clearActiveSkillTrainerAttempt();
    } else {
      setActiveSkillTrainerAttempt(next);
    }
    return next;
  }, [attemptId, clearActiveSkillTrainerAttempt, setActiveSkillTrainerAttempt]);

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

  const cooldownUntil =
    state?.attempt.progress && "cooldown_until" in state.attempt.progress
      ? state.attempt.progress.cooldown_until
      : null;
  const cooldownActive = useCooldownActive(cooldownUntil);

  const resetActionInputs = useCallback(() => {
    setNumericInput("");
    setNumpadInput([]);
    numpadInputRef.current = [];
    setSelectedKeywordId(null);
    calcEngine.reset();
    setCalcDisplay("0");
  }, [calcEngine]);

  const submit = useCallback(
    async (payload: Parameters<typeof skillTrainerApi.submitAction>[1]) => {
      if (!state || actionInFlightRef.current) return;
      actionInFlightRef.current = true;
      setActionInFlight(true);
      setActionError(null);
      resetActionInputs();
      const prev = state;
      try {
        const next = await skillTrainerApi.submitAction(attemptId, payload);
        trackResult(next, prev);
        setState(next);
        if (next.isCompleted) {
          clearActiveSkillTrainerAttempt();
        } else {
          setActiveSkillTrainerAttempt(next);
        }
        if (next.isCompleted) return;
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Action failed");
      } finally {
        actionInFlightRef.current = false;
        setActionInFlight(false);
      }
    },
    [
      attemptId,
      clearActiveSkillTrainerAttempt,
      resetActionInputs,
      setActiveSkillTrainerAttempt,
      state,
      trackResult,
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
  const disabled = cooldownActive || actionInFlight;

  return (
    <div className="space-y-4">
      {cooldownActive && cooldownUntil ? (
        <CooldownOverlay
          until={cooldownUntil}
          durationSeconds={state.attempt.config_snapshot.wrong_cooldown_seconds}
        />
      ) : null}

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
