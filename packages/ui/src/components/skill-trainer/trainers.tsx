"use client";

import type {
  CalculatorMathsItemContent,
  FindConceptItemContent,
  FindWordItemContent,
  MentalMathsItemContent,
  NumpadSpeedItemContent,
  QuickSyllogismItemContent,
} from "@altitutor/shared";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { Button } from "../button";
import { Input } from "../input";
import { CalcKeyChip, CalcKeyDisplay } from "./calc-key-chip";
import { EmbeddedCalculator } from "./embedded-calculator";
import { extractPlainTextFromDoc, hasProseMirrorContent, splitPassageSentences } from "./passage";
import {
  SkillTrainerRichContent,
  type SkillTrainerRichContentProps,
} from "./rich-content-block";

const SENTENCE_HIT_PADDING_PX = 6;

export type SkillTrainerRichContentComponent = React.ComponentType<SkillTrainerRichContentProps>;

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

export function FindWordTrainer({
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

export function FindConceptTrainer({
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

export function QuickSyllogismTrainer({
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

export function NumericTrainer({
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
        autoFocus={!disabled}
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

export function NumpadTrainer({
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
    if (disabled) return;
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
  }, [disabled, onRemoveKey, onSubmit, sequence.length]);

  return (
    <div className="flex min-h-[min(70vh,560px)] flex-col gap-4 lg:flex-row">
      <div className="w-full lg:w-[300px] lg:shrink-0">
        <EmbeddedCalculator
          display=""
          onKey={onCalcKey}
          onEquals={onSubmit}
          showDisplay={false}
          captureKeyboardAlways
          active={!disabled}
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
                  onRemove={disabled ? undefined : () => onRemoveKey(i)}
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

export function CalculatorMathsTrainer({
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
  RichContent = SkillTrainerRichContent,
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
  RichContent?: SkillTrainerRichContentComponent;
}) {
  const plainExpression = content.expression ?? extractPlainTextFromDoc(content.question ?? null);

  return (
    <div className="flex min-h-[min(70vh,560px)] flex-col gap-4 lg:flex-row">
      <article className="min-w-0 flex-1 overflow-y-auto rounded-lg p-4">
        {hasProseMirrorContent(content.question) ? (
          <RichContent json={content.question} plainText={plainExpression} />
        ) : (
          <p className="text-lg font-medium">{plainExpression}</p>
        )}
      </article>
      <div className="flex w-full flex-col gap-4 lg:w-[320px] lg:shrink-0">
        <div onClick={onCalcFocus} onFocus={onCalcFocus}>
          <EmbeddedCalculator
            display={calcDisplay}
            onKey={onCalcKey}
            active={!answerFocused && !disabled}
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

export function MentalMathsTrainer({
  content,
  value,
  inputKey,
  onChange,
  disabled,
  onSubmit,
}: {
  content: MentalMathsItemContent;
  value: string;
  inputKey: string;
  onChange: (v: string) => void;
  disabled: boolean;
  onSubmit: () => void;
}) {
  return (
    <NumericTrainer
      label={content.expression}
      value={value}
      inputKey={inputKey}
      onChange={onChange}
      disabled={disabled}
      allowDecimal
      onSubmit={onSubmit}
    />
  );
}
