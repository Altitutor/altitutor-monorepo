"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input } from "@altitutor/ui";
import {
  UCAT_COLORS,
  UCAT_FONTS,
} from "@altitutor/ui/components/ucat/ucat-theme";
import type {
  CalculatorMathsItemContent,
  FindConceptItemContent,
  FindWordItemContent,
  MentalMathsItemContent,
  NumpadSpeedItemContent,
  QuickSyllogismItemContent,
  UcatSkillTrainerKey,
} from "@altitutor/shared";
import { CalculatorPanel } from "@/features/question-engine/components/calculator-panel";
import { skillTrainerApi } from "@/features/skill-trainer/api/skill-trainer-api";
import type { SkillTrainerAttemptState } from "@/features/skill-trainer/types/attempt";
import {
  extractPlainTextFromDoc,
  splitPassageSentences,
} from "@/features/skill-trainer/lib/passage";

const SENTENCE_HIT_PADDING_PX = 6;
const OCCURRENCE_HIT_PADDING_PX = 4;

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

export function SkillTrainerPlayPage({
  trainerKey,
  attemptId,
}: {
  trainerKey: UcatSkillTrainerKey;
  attemptId: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<SkillTrainerAttemptState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [numericInput, setNumericInput] = useState("");
  const [syllogismAnswer, setSyllogismAnswer] = useState<boolean | null>(null);
  const [numpadInput, setNumpadInput] = useState<string[]>([]);
  const [calcDisplay, setCalcDisplay] = useState("0");
  const [draggingKeywordId, setDraggingKeywordId] = useState<string | null>(null);

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

  const submit = useCallback(
    async (payload: Parameters<typeof skillTrainerApi.submitAction>[1]) => {
      setActionError(null);
      try {
        const next = await skillTrainerApi.submitAction(attemptId, payload);
        setState(next);
        setNumericInput("");
        setSyllogismAnswer(null);
        setNumpadInput([]);
        if (next.isCompleted) return;
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Action failed");
        if (err instanceof Error && err.message === "COOLDOWN_ACTIVE") {
          // keep UI locked via progress.cooldown_until
        }
      }
    },
    [attemptId],
  );

  const cooldownActive = useMemo(() => {
    const progress = state?.attempt.progress;
    if (!progress || !("cooldown_until" in progress) || !progress.cooldown_until) {
      return false;
    }
    return new Date(progress.cooldown_until).getTime() > Date.now();
  }, [state?.attempt.progress]);

  const currentContent = state?.currentItem?.content;

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!state) return <p className="text-sm text-destructive">Attempt not found.</p>;

  if (state.isCompleted) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-8 text-center">
        <h1 className="text-2xl font-semibold">Time&apos;s up!</h1>
        <p className="text-4xl font-bold">{state.attempt.score}</p>
        <p className="text-muted-foreground">Final score</p>
        <div className="flex justify-center gap-3">
          <Button type="button" onClick={() => router.push(`/skill-trainer/${trainerKey}`)}>
            Back to trainer
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/skill-trainer">All trainers</Link>
          </Button>
        </div>
      </div>
    );
  }

  const score = state.attempt.score;
  const streak = state.attempt.streak_count;

  return (
    <div
      className={`space-y-4 font-[${UCAT_FONTS.body}]`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <div className="flex gap-6 text-sm">
          <span>
            Time: <strong>{remaining}s</strong>
          </span>
          <span>
            Score: <strong>{score}</strong>
          </span>
          {state.attempt.config_snapshot.streak_enabled ? (
            <span>
              Streak: <strong>{streak}</strong>
            </span>
          ) : null}
        </div>
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href={`/skill-trainer/${trainerKey}`}>Exit</Link>
        </Button>
      </div>

      {cooldownActive ? (
        <p className="text-sm text-amber-700">Cooldown — wait before your next action.</p>
      ) : null}
      {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}

      {trainerKey === "find_word" && currentContent ? (
        <FindWordTrainer
          content={currentContent as unknown as FindWordItemContent}
          placedIds={
            state.attempt.progress?.type === "find_word"
              ? state.attempt.progress.placed_keyword_ids
              : []
          }
          draggingKeywordId={draggingKeywordId}
          onDragKeyword={setDraggingKeywordId}
          disabled={cooldownActive}
          onDropSentence={(keywordId, sentenceIndex) =>
            void submit({ type: "place_word", keyword_id: keywordId, sentence_index: sentenceIndex })
          }
        />
      ) : null}

      {trainerKey === "find_concept" && currentContent ? (
        <FindConceptTrainer
          content={currentContent as unknown as FindConceptItemContent}
          foundIndexes={
            state.attempt.progress?.type === "find_concept"
              ? state.attempt.progress.found_occurrence_indexes
              : []
          }
          disabled={cooldownActive}
          onClickOccurrence={(index) =>
            void submit({ type: "click_occurrence", occurrence_index: index })
          }
          onSubmit={() => void submit({ type: "submit_concept" })}
        />
      ) : null}

      {trainerKey === "quick_syllogism" && currentContent ? (
        <QuickSyllogismTrainer
          content={currentContent as unknown as QuickSyllogismItemContent}
          selected={syllogismAnswer}
          onSelect={setSyllogismAnswer}
          disabled={cooldownActive}
          onSubmit={() => {
            if (syllogismAnswer == null) return;
            void submit({ type: "syllogism_answer", answer: syllogismAnswer });
          }}
        />
      ) : null}

      {trainerKey === "mental_maths" && currentContent ? (
        <NumericTrainer
          label={(currentContent as unknown as MentalMathsItemContent).expression}
          value={numericInput}
          onChange={setNumericInput}
          disabled={cooldownActive}
          onSubmit={() => {
            const n = Number(numericInput);
            if (Number.isNaN(n)) return;
            void submit({ type: "numeric_answer", answer: n });
          }}
        />
      ) : null}

      {trainerKey === "numpad_speed" && currentContent ? (
        <NumpadTrainer
          content={currentContent as unknown as NumpadSpeedItemContent}
          sequence={numpadInput}
          calcDisplay={calcDisplay}
          onCalcKey={(key) => {
            setNumpadInput((prev) => [...prev, key]);
            setCalcDisplay(key);
          }}
          disabled={cooldownActive}
          onSubmit={() =>
            void submit({ type: "numpad_sequence", sequence: numpadInput })
          }
        />
      ) : null}

      {trainerKey === "calculator_maths" && currentContent ? (
        <CalculatorMathsTrainer
          content={currentContent as unknown as CalculatorMathsItemContent}
          value={numericInput}
          calcDisplay={calcDisplay}
          onChange={setNumericInput}
          onCalcKey={(key) => setCalcDisplay(key)}
          disabled={cooldownActive}
          onSubmit={() => {
            const n = Number(numericInput);
            if (Number.isNaN(n)) return;
            void submit({ type: "numeric_answer", answer: n });
          }}
        />
      ) : null}
    </div>
  );
}

function FindWordTrainer({
  content,
  placedIds,
  draggingKeywordId,
  onDragKeyword,
  disabled,
  onDropSentence,
}: {
  content: FindWordItemContent;
  placedIds: string[];
  draggingKeywordId: string | null;
  onDragKeyword: (id: string | null) => void;
  disabled: boolean;
  onDropSentence: (keywordId: string, sentenceIndex: number) => void;
}) {
  const plain = extractPlainTextFromDoc(content.passage);
  const sentences = splitPassageSentences(plain);
  const remaining = content.keywords.filter((k) => !placedIds.includes(k.id));

  return (
    <div className="flex h-[min(70vh,640px)] min-h-0 gap-4 text-[11pt] leading-relaxed">
      <article
        className="flex-[3] min-w-0 overflow-y-auto border-r-[6px] pr-4 py-4"
        style={{ borderRightColor: UCAT_COLORS.primaryBlue }}
      >
        <div className="space-y-1">
          {sentences.map((sentence, index) => (
            <p
              key={index}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (disabled || !draggingKeywordId) return;
                onDropSentence(draggingKeywordId, index);
                onDragKeyword(null);
              }}
              className="rounded-sm transition-colors hover:bg-blue-50/80"
              style={{ padding: SENTENCE_HIT_PADDING_PX }}
            >
              {sentence}
            </p>
          ))}
        </div>
      </article>
      <section className="flex flex-[2] flex-col justify-end gap-2 p-4">
        {remaining.map((keyword) => (
          <button
            key={keyword.id}
            type="button"
            draggable={!disabled}
            onDragStart={() => onDragKeyword(keyword.id)}
            onDragEnd={() => onDragKeyword(null)}
            className="rounded border border-[#9ba9bd] bg-white px-3 py-2 text-left shadow-sm"
          >
            {keyword.text}
          </button>
        ))}
      </section>
    </div>
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
  const segments: Array<{ text: string; occurrenceIndex?: number; found?: boolean }> = [];
  let cursor = 0;
  const sorted = content.occurrences
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
    <div className="flex h-[min(70vh,640px)] min-h-0 gap-4 text-[11pt] leading-relaxed">
      <article
        className="flex-[3] min-w-0 overflow-y-auto border-r-[6px] pr-4 py-4"
        style={{ borderRightColor: UCAT_COLORS.primaryBlue }}
      >
        <p className="whitespace-pre-wrap">
          {segments.map((seg, i) =>
            seg.occurrenceIndex != null ? (
              <button
                key={i}
                type="button"
                disabled={disabled || seg.found}
                onClick={() => onClickOccurrence(seg.occurrenceIndex!)}
                className={`rounded-sm underline decoration-2 ${
                  seg.found ? "bg-green-100" : "hover:bg-amber-100"
                }`}
                style={{ padding: OCCURRENCE_HIT_PADDING_PX }}
              >
                {seg.text}
              </button>
            ) : (
              <span key={i}>{seg.text}</span>
            ),
          )}
        </p>
      </article>
      <section className="flex flex-[2] flex-col justify-end gap-3 p-4">
        <p className="text-sm font-medium">Find: {content.concept}</p>
        <Button type="button" disabled={disabled} onClick={onSubmit}>
          Submit
        </Button>
      </section>
    </div>
  );
}

function QuickSyllogismTrainer({
  content,
  selected,
  onSelect,
  disabled,
  onSubmit,
}: {
  content: QuickSyllogismItemContent;
  selected: boolean | null;
  onSelect: (v: boolean) => void;
  disabled: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl space-y-6 py-8 text-center">
      <p className="text-lg">{content.statement}</p>
      <div className="flex justify-center gap-3">
        <Button
          type="button"
          variant={selected === true ? "default" : "outline"}
          disabled={disabled}
          onClick={() => onSelect(true)}
        >
          Yes
        </Button>
        <Button
          type="button"
          variant={selected === false ? "default" : "outline"}
          disabled={disabled}
          onClick={() => onSelect(false)}
        >
          No
        </Button>
      </div>
      <Button type="button" disabled={disabled || selected == null} onClick={onSubmit}>
        Submit
      </Button>
    </div>
  );
}

function NumericTrainer({
  label,
  value,
  onChange,
  disabled,
  onSubmit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="mx-auto max-w-md space-y-4 py-12 text-center">
      <p className="text-2xl font-medium">{label}</p>
      <Input
        type="number"
        value={value}
        disabled={disabled}
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
  calcDisplay,
  onCalcKey,
  disabled,
  onSubmit,
}: {
  content: NumpadSpeedItemContent;
  sequence: string[];
  calcDisplay: string;
  onCalcKey: (key: string) => void;
  disabled: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-muted-foreground">
        {content.label ?? "Enter the button sequence"}
      </p>
      <p className="text-center font-mono text-sm">{sequence.join(" · ") || "—"}</p>
      <div className="flex justify-center">
        <CalculatorPanel display={calcDisplay} onKey={onCalcKey} onClose={() => {}} />
      </div>
      <div className="flex justify-center">
        <Button type="button" disabled={disabled || sequence.length === 0} onClick={onSubmit}>
          Submit sequence
        </Button>
      </div>
    </div>
  );
}

function CalculatorMathsTrainer({
  content,
  value,
  calcDisplay,
  onChange,
  onCalcKey,
  disabled,
  onSubmit,
}: {
  content: CalculatorMathsItemContent;
  value: string;
  calcDisplay: string;
  onChange: (v: string) => void;
  onCalcKey: (key: string) => void;
  disabled: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-center text-xl font-medium">{content.expression}</p>
      <div className="flex justify-center">
        <CalculatorPanel display={calcDisplay} onKey={onCalcKey} onClose={() => {}} />
      </div>
      <div className="mx-auto flex max-w-xs gap-2">
        <Input
          type="number"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
        />
        <Button type="button" disabled={disabled || !value} onClick={onSubmit}>
          Submit
        </Button>
      </div>
    </div>
  );
}
