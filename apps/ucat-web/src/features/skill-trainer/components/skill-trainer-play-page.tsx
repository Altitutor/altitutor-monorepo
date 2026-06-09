"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@altitutor/ui";
import { trainerKeyToSlug } from "@altitutor/shared";
import type {
  CalculatorMathsItemContent,
  FindConceptItemContent,
  FindWordItemContent,
  NumpadSpeedItemContent,
  QuickSyllogismItemContent,
  UcatSkillTrainerKey,
} from "@altitutor/shared";
import { RichContentBlock } from "@/features/question-engine/components/rich-content-block";
import { useSidebarOverride } from "@/features/layout/context/sidebar-override-context";
import { skillTrainerApi } from "@/features/skill-trainer/api/skill-trainer-api";
import type { SkillTrainerAttemptState } from "@/features/skill-trainer/types/attempt";
import {
  extractPlainTextFromDoc,
  splitPassageSentences,
} from "@/features/skill-trainer/lib/passage";
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
import { CalcKeyChip, CalcKeyDisplay } from "@/features/skill-trainer/components/calc-key-chip";
import { CooldownOverlay } from "@/features/skill-trainer/components/cooldown-overlay";
import { EmbeddedCalculator } from "@/features/skill-trainer/components/embedded-calculator";
import { SkillTrainerCompleteScreen } from "@/features/skill-trainer/components/skill-trainer-complete-screen";
import { SkillTrainerScoreBar } from "@/features/skill-trainer/components/skill-trainer-score-bar";
import { cn } from "@/lib/utils";

const SENTENCE_HIT_PADDING_PX = 6;
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
}: {
  trainerKey: UcatSkillTrainerKey;
  attemptId: string;
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
  const numpadInputRef = useRef<string[]>([]);
  const sidebarOverride = useSidebarOverride();
  const { feedback, trackResult } = useActionFeedback();
  const inProgress = Boolean(state && !state.isCompleted);
  const { allowLeave } = useLeaveGuard(inProgress, LEAVE_MESSAGE);

  const refresh = useCallback(async () => {
    const next = await skillTrainerApi.getAttempt(attemptId);
    setState(next);
    return next;
  }, [attemptId]);

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

  const submit = useCallback(
    async (payload: Parameters<typeof skillTrainerApi.submitAction>[1]) => {
      if (!state) return;
      setActionError(null);
      const prev = state;
      try {
        const next = await skillTrainerApi.submitAction(attemptId, payload);
        trackResult(next, prev);
        setState(next);
        setNumericInput("");
        setNumpadInput([]);
        setSelectedKeywordId(null);
        calcEngine.reset();
        setCalcDisplay("0");
        if (next.isCompleted) return;
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Action failed");
      }
    },
    [attemptId, calcEngine, state, trackResult],
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

  useEffect(() => {
    numpadInputRef.current = numpadInput;
  }, [numpadInput]);

  useEffect(() => {
    if (!sidebarOverride) return;
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
  }, [sidebarOverride, state?.isCompleted]);

  useEffect(() => {
    if (state?.isCompleted) {
      void refresh();
    }
  }, [state?.isCompleted, refresh]);

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

  if (state.isCompleted) {
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
  const disabled = cooldownActive;

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
        <NumericTrainer
          label={mentalMathsContent.expression}
          inputKey={currentItemId ?? "mental"}
          value={numericInput}
          onChange={setNumericInput}
          disabled={disabled}
          allowDecimal
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
        />
      ) : null}
    </div>
  );
}

function PassageLayout({
  passage,
  sidebar,
}: {
  passage: React.ReactNode;
  sidebar: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[min(70vh,640px)] flex-col gap-4 lg:flex-row">
      <article className="min-w-0 flex-1 overflow-y-auto rounded-lg p-4 text-sm leading-relaxed">
        {passage}
      </article>
      <section className="flex w-full flex-col gap-3 rounded-lg p-4 lg:w-[320px] lg:shrink-0">
        {sidebar}
      </section>
    </div>
  );
}

function FindWordTrainer({
  content,
  placedIds,
  selectedKeywordId,
  draggingKeywordId,
  onSelectKeyword,
  onDragKeyword,
  disabled,
  onPlace,
}: {
  content: FindWordItemContent;
  placedIds: string[];
  selectedKeywordId: string | null;
  draggingKeywordId: string | null;
  onSelectKeyword: (id: string | null) => void;
  onDragKeyword: (id: string | null) => void;
  disabled: boolean;
  onPlace: (keywordId: string, sentenceIndex: number) => void;
}) {
  const plain = extractPlainTextFromDoc(content.passage);
  const sentences = splitPassageSentences(plain);
  const keywords = content.keywords ?? [];
  const remaining = keywords.filter((k) => !placedIds.includes(k.id));
  const activeKeywordId = draggingKeywordId ?? selectedKeywordId;

  return (
    <PassageLayout
      passage={
        <div className="space-y-1">
          {sentences.map((sentence, index) => (
            <p
              key={index}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (disabled || !draggingKeywordId) return;
                onPlace(draggingKeywordId, index);
                onDragKeyword(null);
                onSelectKeyword(null);
              }}
              onClick={() => {
                if (disabled || !selectedKeywordId) return;
                onPlace(selectedKeywordId, index);
                onSelectKeyword(null);
              }}
              className={cn(
                "rounded-sm transition-colors",
                activeKeywordId ? "cursor-pointer hover:bg-primary/10" : "",
              )}
              style={{ padding: SENTENCE_HIT_PADDING_PX }}
            >
              {sentence}
            </p>
          ))}
        </div>
      }
      sidebar={
        <>
          <p className="text-sm font-medium text-muted-foreground">Keywords</p>
          <div className="flex flex-wrap gap-2">
            {remaining.map((keyword) => (
              <button
                key={keyword.id}
                type="button"
                draggable={!disabled}
                disabled={disabled}
                onClick={() =>
                  onSelectKeyword(selectedKeywordId === keyword.id ? null : keyword.id)
                }
                onDragStart={() => onDragKeyword(keyword.id)}
                onDragEnd={() => onDragKeyword(null)}
                className={cn(
                  "rounded-md border bg-background px-3 py-2 text-left text-sm shadow-sm transition-colors",
                  selectedKeywordId === keyword.id
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border hover:border-primary/50",
                )}
              >
                {keyword.text}
              </button>
            ))}
          </div>
          {selectedKeywordId ? (
            <p className="text-xs text-muted-foreground">Click a sentence where this word appears.</p>
          ) : null}
        </>
      }
    />
  );
}

function FindConceptTrainer({
  content,
  foundIndexes,
  disabled,
  onClickOccurrence,
  onSubmit,
}: {
  content: FindConceptItemContent;
  foundIndexes: number[];
  disabled: boolean;
  onClickOccurrence: (index: number) => void;
  onSubmit: () => void;
}) {
  const plain = extractPlainTextFromDoc(content.passage);
  const occurrences = content.occurrences ?? [];

  return (
    <PassageLayout
      passage={
        <p className="whitespace-pre-wrap">
          <ConceptPassageText
            plain={plain}
            occurrences={occurrences}
            foundIndexes={foundIndexes}
            disabled={disabled}
            onClickOccurrence={onClickOccurrence}
          />
        </p>
      }
      sidebar={
        <>
          <p className="text-sm font-medium">Find: {content.concept}</p>
          <p className="text-xs text-muted-foreground">
            Click every occurrence in the passage, then submit.
          </p>
          <Button type="button" disabled={disabled} onClick={onSubmit} className="mt-auto">
            Submit
          </Button>
        </>
      }
    />
  );
}

function ConceptPassageText({
  plain,
  occurrences,
  foundIndexes,
  disabled,
  onClickOccurrence,
}: {
  plain: string;
  occurrences: FindConceptItemContent["occurrences"];
  foundIndexes: number[];
  disabled: boolean;
  onClickOccurrence: (index: number) => void;
}) {
  const segments: Array<{ text: string; occurrenceIndex?: number; found?: boolean }> = [];
  let cursor = 0;
  const sorted = (occurrences ?? [])
    .map((o, index) => ({ ...o, index }))
    .sort((a, b) => a.start - b.start);

  for (const occ of sorted) {
    if (occ.start > cursor) {
      segments.push({ text: plain.slice(cursor, occ.start) });
    }
    segments.push({
      text: plain.slice(occ.start, occ.end),
      occurrenceIndex: occ.index,
      found: foundIndexes.includes(occ.index),
    });
    cursor = occ.end;
  }
  if (cursor < plain.length) segments.push({ text: plain.slice(cursor) });

  return (
    <>
      {segments.map((seg, i) =>
        seg.occurrenceIndex != null ? (
          <button
            key={i}
            type="button"
            disabled={disabled || seg.found}
            onClick={() => onClickOccurrence(seg.occurrenceIndex!)}
            className={cn(
              "inline p-0 align-baseline font-inherit text-inherit leading-inherit",
              seg.found
                ? "rounded-sm bg-green-200/80 ring-1 ring-green-600"
                : "cursor-pointer border-0 bg-transparent",
            )}
          >
            {seg.text}
          </button>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}

function QuickSyllogismTrainer({
  content,
  disabled,
  onAnswer,
}: {
  content: QuickSyllogismItemContent;
  disabled: boolean;
  onAnswer: (answer: boolean) => void;
}) {
  const [dropped, setDropped] = useState<"yes" | "no" | null>(null);

  useEffect(() => {
    setDropped(null);
  }, [content.statement]);

  useEffect(() => {
    if (disabled) setDropped(null);
  }, [disabled]);

  const handleDrop = (choice: "yes" | "no") => {
    if (disabled) return;
    setDropped(choice);
    onAnswer(choice === "yes");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <p className="text-center text-lg">{content.statement}</p>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center">
        <div
          className="flex h-14 w-28 items-center justify-center rounded border border-dashed border-muted-foreground/50 bg-muted/30"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const choice = e.dataTransfer.getData("ucat-syllogism-choice") as "yes" | "no" | "";
            if (choice === "yes" || choice === "no") handleDrop(choice);
          }}
        >
          {dropped ? (
            <span className="rounded border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground shadow-sm">
              {dropped === "yes" ? "Yes" : "No"}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Drop answer</span>
          )}
        </div>
        <div className="w-[139px] rounded border border-border bg-muted/50 px-2 py-2">
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              draggable={!disabled}
              disabled={disabled}
              onDragStart={(e) => {
                e.dataTransfer.setData("ucat-syllogism-choice", "yes");
                e.dataTransfer.effectAllowed = "copy";
              }}
              className="flex h-9 w-20 items-center justify-center rounded border border-border bg-card text-sm font-medium text-card-foreground shadow-sm"
            >
              Yes
            </button>
            <button
              type="button"
              draggable={!disabled}
              disabled={disabled}
              onDragStart={(e) => {
                e.dataTransfer.setData("ucat-syllogism-choice", "no");
                e.dataTransfer.effectAllowed = "copy";
              }}
              className="flex h-9 w-20 items-center justify-center rounded border border-border bg-card text-sm font-medium text-card-foreground shadow-sm"
            >
              No
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumericTrainer({
  label,
  value,
  inputKey,
  onChange,
  disabled,
  allowDecimal,
  onSubmit,
}: {
  label: string;
  value: string;
  inputKey: string;
  onChange: (v: string) => void;
  disabled: boolean;
  allowDecimal?: boolean;
  onSubmit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (disabled) return;
    inputRef.current?.focus();
  }, [inputKey, disabled]);

  useEffect(() => {
    if (disabled) return;
    const handleWindowKey = (event: KeyboardEvent) => {
      if (document.activeElement === inputRef.current) return;
      if (
        event.key.length === 1 &&
        (/^[0-9.-]$/.test(event.key) || event.key === "Enter")
      ) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleWindowKey);
    return () => window.removeEventListener("keydown", handleWindowKey);
  }, [disabled, inputKey]);

  return (
    <div className="mx-auto max-w-md space-y-4 py-12 text-center">
      <p className="text-2xl font-medium">{label}</p>
      <Input
        ref={inputRef}
        type="number"
        step={allowDecimal ? "any" : "1"}
        value={value}
        disabled={disabled}
        autoFocus
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
        }}
      />
      <Button type="button" disabled={disabled || !value} onClick={onSubmit}>
        Submit
      </Button>
    </div>
  );
}

function NumpadTrainer({
  content,
  sequence,
  onCalcKey,
  onRemoveKey,
  onSubmit,
  disabled,
}: {
  content: NumpadSpeedItemContent;
  sequence: string[];
  onCalcKey: (key: string) => void;
  onRemoveKey: (index: number) => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  const targetSequence = (content.button_sequence ?? []).filter((btn) => btn !== "=");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Backspace" && sequence.length > 0) {
        e.preventDefault();
        onRemoveKey(sequence.length - 1);
      }
      if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        onSubmit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onRemoveKey, onSubmit, sequence.length]);

  return (
    <div className="flex min-h-[min(70vh,560px)] flex-col gap-4 lg:flex-row">
      <div className="w-full lg:w-[300px] lg:shrink-0">
        <EmbeddedCalculator
          display=""
          onKey={onCalcKey}
          onEquals={onSubmit}
          showDisplay={false}
          captureKeyboardAlways
          active
        />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">Target sequence</p>
          <div className="flex flex-wrap gap-1.5">
            {targetSequence.map((label, i) => (
              <CalcKeyDisplay key={`${label}-${i}`} label={label} />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Your sequence</p>
          <div className="flex min-h-[40px] flex-wrap gap-1.5">
            {sequence.length === 0 ? (
              <span className="text-sm text-muted-foreground">Press keys on the calculator…</span>
            ) : (
              sequence.map((label, i) => (
                <CalcKeyChip
                  key={`${label}-${i}`}
                  label={label}
                  onRemove={() => onRemoveKey(i)}
                  disabled={disabled}
                />
              ))
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Press = or Enter to submit. Backspace removes the last key.
          </p>
        </div>
        {content.label ? (
          <p className="text-sm text-muted-foreground">{content.label}</p>
        ) : null}
      </div>
    </div>
  );
}

function CalculatorMathsTrainer({
  content,
  value,
  calcDisplay,
  answerFocused,
  onAnswerFocus,
  onCalcFocus,
  onChange,
  onCalcKey,
  disabled,
  onSubmit,
}: {
  content: CalculatorMathsItemContent;
  value: string;
  calcDisplay: string;
  answerFocused: boolean;
  onAnswerFocus: () => void;
  onCalcFocus: () => void;
  onChange: (v: string) => void;
  onCalcKey: (key: string) => void;
  disabled: boolean;
  onSubmit: () => void;
}) {
  const plainExpression = content.expression ?? "";

  return (
    <div className="flex min-h-[min(70vh,560px)] flex-col gap-4 lg:flex-row">
      <article className="min-w-0 flex-1 overflow-y-auto rounded-lg p-4">
        {content.question ? (
          <RichContentBlock json={content.question} plainText={plainExpression} />
        ) : (
          <p className="text-lg font-medium">{plainExpression}</p>
        )}
      </article>
      <div className="flex w-full flex-col gap-4 lg:w-[320px] lg:shrink-0">
        <div onClick={onCalcFocus} onFocus={onCalcFocus}>
          <EmbeddedCalculator
            display={calcDisplay}
            onKey={onCalcKey}
            active={!answerFocused}
          />
        </div>
        <div
          className={cn(
            "rounded-lg border p-3 transition-colors",
            answerFocused ? "border-primary ring-2 ring-primary/30" : "border-border",
          )}
          onClick={onAnswerFocus}
        >
          <label className="mb-2 block text-sm font-medium">Your answer</label>
          <Input
            type="number"
            step="any"
            value={value}
            disabled={disabled}
            onFocus={onAnswerFocus}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmit();
            }}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Click here to type your answer, or click the calculator to use it.
          </p>
        </div>
      </div>
    </div>
  );
}
