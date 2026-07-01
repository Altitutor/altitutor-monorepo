"use client";

import type {
  CalculatorMathsItemContent,
  FindConceptItemContent,
  FindWordKeywordOccurrence,
  FindWordItemContent,
  MentalMathsItemContent,
  NumpadSpeedItemContent,
  QuickSyllogismItemContent,
} from "@altitutor/shared";
import {
  findFindWordKeywordOccurrences,
} from "@altitutor/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { Button } from "../button";
import { Input } from "../input";
import { CalcKeyChip, CalcKeyDisplay } from "./calc-key-chip";
import { EmbeddedCalculator } from "./embedded-calculator";
import {
  extractPlainTextFromDoc,
  extractPlainTextWithBlockBreaks,
  hasProseMirrorContent,
} from "./passage";
import {
  SkillTrainerRichContent,
  type SkillTrainerRichContentProps,
} from "./rich-content-block";

const WORD_HIT_PADDING_PX = 3;

export type SkillTrainerRichContentComponent = React.ComponentType<SkillTrainerRichContentProps>;
export type SkillTrainerFeedbackOrigin = { x: number; y: number };

type PassageSegment = {
  text: string;
  occurrence?: FindWordKeywordOccurrence;
  occurrenceIndex?: number;
  found?: boolean;
};

function splitSegmentsIntoParagraphs(segments: PassageSegment[]): PassageSegment[][] {
  const paragraphs: PassageSegment[][] = [[]];

  for (const segment of segments) {
    const parts = segment.text.split(/\r?\n/u);
    parts.forEach((part, index) => {
      if (index > 0) paragraphs.push([]);
      if (part) {
        paragraphs[paragraphs.length - 1]!.push({ ...segment, text: part });
      }
    });
  }

  return paragraphs;
}

function getElementCenter(element: HTMLElement | null): SkillTrainerFeedbackOrigin | undefined {
  if (!element) return undefined;
  const rect = element.getBoundingClientRect();
  return {
    x: Math.round(rect.left + rect.width / 2),
    y: Math.round(rect.top + rect.height / 2),
  };
}

function PassageLayout({
  passage,
  sidebar,
}: {
  passage: React.ReactNode;
  sidebar: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[min(70vh,640px)] flex-col gap-4 md:flex-row">
      <article className="min-w-0 flex-1 overflow-y-auto rounded-lg p-4 text-sm leading-relaxed">
        {passage}
      </article>
      <section className="flex w-full flex-col gap-3 rounded-lg p-4 md:w-[320px] md:shrink-0">
        {sidebar}
      </section>
    </div>
  );
}

export function FindWordTrainer({
  content,
  shuffleKey,
  placedIds,
  selectedKeywordId,
  draggingKeywordId,
  onSelectKeyword,
  onDragKeyword,
  disabled,
  onPlace,
}: {
  content: FindWordItemContent;
  shuffleKey?: string;
  placedIds: string[];
  selectedKeywordId: string | null;
  draggingKeywordId: string | null;
  onSelectKeyword: (id: string | null) => void;
  onDragKeyword: (id: string | null) => void;
  disabled: boolean;
  onPlace: (keywordId: string, characterIndex: number) => void;
}) {
  const plain = extractPlainTextWithBlockBreaks(content.passage);
  const keywords = useMemo(() => content.keywords ?? [], [content.keywords]);
  const keywordSignature = useMemo(
    () => keywords.map((keyword) => keyword.id).join("\u001F"),
    [keywords],
  );
  const [shuffledKeywordIds, setShuffledKeywordIds] = useState<string[]>([]);
  const displayKeywords = useMemo(() => {
    const byId = new Map(keywords.map((keyword) => [keyword.id, keyword]));
    if (
      shuffledKeywordIds.length !== keywords.length ||
      shuffledKeywordIds.some((id) => !byId.has(id))
    ) {
      return keywords;
    }
    return shuffledKeywordIds.map((id) => byId.get(id)).filter(Boolean) as typeof keywords;
  }, [keywords, shuffledKeywordIds]);
  const activeKeywordId = draggingKeywordId ?? selectedKeywordId;
  const activeKeyword = keywords.find((keyword) => keyword.id === activeKeywordId) ?? null;
  const activeOccurrences = useMemo(
    () => (activeKeyword ? findFindWordKeywordOccurrences(plain, activeKeyword) : []),
    [activeKeyword, plain],
  );

  useEffect(() => {
    const ids = keywords.map((keyword) => keyword.id);
    for (let i = ids.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    }
    setShuffledKeywordIds(ids);
  }, [shuffleKey, keywordSignature]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (disabled) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!/^[1-9]$/.test(event.key)) return;
      const nextKeyword = displayKeywords[Number(event.key) - 1];
      if (!nextKeyword || placedIds.includes(nextKeyword.id)) return;
      event.preventDefault();
      onSelectKeyword(selectedKeywordId === nextKeyword.id ? null : nextKeyword.id);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled, displayKeywords, onSelectKeyword, placedIds, selectedKeywordId]);

  const submitWrongPlacement = () => {
    const keywordId = draggingKeywordId ?? selectedKeywordId;
    if (disabled || !keywordId) return;
    onPlace(keywordId, -1);
    onDragKeyword(null);
  };

  const renderPassage = () => {
    const segments: PassageSegment[] = [];
    let cursor = 0;
    for (const occurrence of activeOccurrences) {
      if (occurrence.start > cursor) {
        segments.push({ text: plain.slice(cursor, occurrence.start) });
      }
      segments.push({
        text: plain.slice(occurrence.start, occurrence.end),
        occurrence,
      });
      cursor = occurrence.end;
    }
    if (!activeKeywordId || activeOccurrences.length === 0) {
      segments.push({ text: plain || "\u00A0" });
    } else {
      if (cursor < plain.length) segments.push({ text: plain.slice(cursor) });
    }

    const paragraphs = splitSegmentsIntoParagraphs(segments);

    return (
      <div
        className={cn(activeKeywordId && !disabled ? "cursor-pointer" : "")}
        onClick={() => {
          if (!selectedKeywordId) return;
          submitWrongPlacement();
        }}
        onDragOver={(event) => {
          if (!draggingKeywordId || disabled) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (!draggingKeywordId) return;
          submitWrongPlacement();
        }}
      >
        <div className="space-y-4">
          {paragraphs.map((paragraph, paragraphIndex) => (
            <p key={paragraphIndex} className="whitespace-pre-wrap">
              {paragraph.length === 0
                ? "\u00A0"
                : paragraph.map((segment, index) =>
                    segment.occurrence ? (
                      <button
                        key={index}
                        type="button"
                        disabled={disabled}
                        onDragOver={(event) => {
                          if (!draggingKeywordId || disabled) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (disabled || !draggingKeywordId || draggingKeywordId !== activeKeywordId) return;
                          onPlace(draggingKeywordId, segment.occurrence!.start);
                          onDragKeyword(null);
                          onSelectKeyword(null);
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (disabled || !selectedKeywordId || selectedKeywordId !== activeKeywordId) return;
                          onPlace(selectedKeywordId, segment.occurrence!.start);
                          onSelectKeyword(null);
                        }}
                        className={cn(
                          "inline rounded-sm border-0 bg-transparent p-0 align-baseline font-inherit text-inherit leading-inherit",
                          activeKeywordId && !disabled ? "cursor-pointer" : "",
                        )}
                        style={{
                          marginInline: -WORD_HIT_PADDING_PX,
                          paddingInline: WORD_HIT_PADDING_PX,
                          paddingBlock: 0,
                        }}
                      >
                        {segment.text}
                      </button>
                    ) : (
                      <span key={index}>{segment.text}</span>
                    ),
                  )}
            </p>
          ))}
        </div>
      </div>
    );
  };

  return (
    <PassageLayout
      passage={renderPassage()}
      sidebar={
        <>
          <p className="text-sm font-medium text-muted-foreground">Keywords</p>
          <div className="flex flex-wrap gap-2">
            {displayKeywords.map((keyword, shortcutIndex) => {
              const placed = placedIds.includes(keyword.id);
              return (
                <button
                  key={keyword.id}
                  type="button"
                  draggable={!disabled && !placed}
                  disabled={disabled || placed}
                  onClick={() =>
                    onSelectKeyword(selectedKeywordId === keyword.id ? null : keyword.id)
                  }
                  onDragStart={(event) => {
                    if (placed) {
                      event.preventDefault();
                      return;
                    }
                    event.dataTransfer.effectAllowed = "move";
                    onDragKeyword(keyword.id);
                  }}
                  onDragEnd={() => onDragKeyword(null)}
                  className={cn(
                    "rounded-md border bg-background px-3 py-2 text-left text-sm shadow-sm transition-colors",
                    placed
                      ? "border-border bg-muted text-muted-foreground opacity-60"
                      : selectedKeywordId === keyword.id
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  {shortcutIndex < 9 ? (
                    <span className="mr-2 inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 text-[11px] font-semibold text-muted-foreground">
                      {shortcutIndex + 1}
                    </span>
                  ) : null}
                  {keyword.text}
                </button>
              );
            })}
          </div>
          {selectedKeywordId ? (
            <p className="text-xs text-muted-foreground">Click the word where it appears.</p>
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
  const segments: PassageSegment[] = [];
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

  const paragraphs = splitSegmentsIntoParagraphs(segments);

  return (
    <div className="space-y-4">
      {paragraphs.map((paragraph, paragraphIndex) => (
        <p key={paragraphIndex} className="whitespace-pre-wrap">
          {paragraph.length === 0
            ? "\u00A0"
            : paragraph.map((seg, i) =>
                seg.occurrenceIndex != null ? (
                  <button
                    key={i}
                    type="button"
                    disabled={disabled || seg.found}
                    onClick={(event) => {
                      event.stopPropagation();
                      onClickOccurrence(seg.occurrenceIndex!);
                    }}
                    className={cn(
                      "inline p-0 align-baseline font-inherit leading-inherit",
                      seg.found
                        ? "rounded-sm bg-green-500 text-white ring-1 ring-green-500"
                        : "cursor-pointer border-0 bg-transparent text-inherit",
                    )}
                  >
                    {seg.text}
                  </button>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )}
        </p>
      ))}
    </div>
  );
}

export function FindConceptTrainer({
  content,
  foundIndexes,
  disabled,
  onClickOccurrence,
  onSkip,
}: {
  content: FindConceptItemContent;
  foundIndexes: number[];
  disabled: boolean;
  onClickOccurrence: (index: number) => void;
  onSkip: () => void;
}) {
  const plain = extractPlainTextFromDoc(content.passage);
  const occurrences = content.occurrences ?? [];
  const remainingCount = Math.max(0, occurrences.length - foundIndexes.length);

  return (
    <PassageLayout
      passage={
        <div
          className={disabled ? "" : "cursor-pointer"}
          onClick={() => {
            if (!disabled) onClickOccurrence(-1);
          }}
        >
          <ConceptPassageText
            plain={plain}
            occurrences={occurrences}
            foundIndexes={foundIndexes}
            disabled={disabled}
            onClickOccurrence={onClickOccurrence}
          />
        </div>
      }
      sidebar={
        <>
          <p className="text-sm font-medium">Find: {content.concept}</p>
          <p className="text-xs text-muted-foreground">
            Click every occurrence in the passage.
          </p>
          <Button
            type="button"
            variant="destructive"
            disabled={disabled || remainingCount === 0}
            onClick={onSkip}
          >
            Skip
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
  onSubmit: (origin?: SkillTrainerFeedbackOrigin) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

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
      <div className="flex items-stretch gap-2">
        <Input
          ref={inputRef}
          type="number"
          step={allowDecimal ? "any" : "1"}
          value={value}
          disabled={disabled}
          autoFocus={!disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit(getElementCenter(submitButtonRef.current));
        }}
      />
        <Button
          ref={submitButtonRef}
          type="button"
          disabled={disabled || !value}
          onClick={() => onSubmit(getElementCenter(submitButtonRef.current))}
        >
          Submit
          <span className="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Enter
          </span>
        </Button>
      </div>
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
  onSubmit: (origin?: SkillTrainerFeedbackOrigin) => void;
  disabled: boolean;
}) {
  const targetSequence = content.button_sequence ?? [];
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex min-h-[calc(100vh-140px)] flex-col gap-4 md:flex-row">
      <article className="flex min-w-0 flex-1 flex-col items-center gap-6 overflow-y-auto rounded-lg p-6 text-center">
        <div className="space-y-2">
          <p className="text-sm font-medium">Target sequence</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {targetSequence.map((label, i) => (
              <CalcKeyDisplay key={`${label}-${i}`} label={label} />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Your sequence</p>
          <div className="flex min-h-[40px] flex-wrap justify-center gap-1.5">
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
        </div>
        <Button
          ref={submitButtonRef}
          type="button"
          disabled={disabled || sequence.length === 0}
          onClick={() => onSubmit(getElementCenter(submitButtonRef.current))}
        >
          Submit
          <span className="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Enter
          </span>
        </Button>
      </article>
      <div className="flex w-full justify-center rounded-lg p-1 md:w-[320px] md:shrink-0">
        <div className="w-full max-w-[300px]">
          <EmbeddedCalculator
            display=""
            onKey={onCalcKey}
            onEquals={() => onSubmit(getElementCenter(submitButtonRef.current))}
            onBackspace={() => {
              if (sequence.length > 0) onRemoveKey(sequence.length - 1);
            }}
            showDisplay={false}
            captureKeyboardAlways
            active={!disabled}
          />
        </div>
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
  onSubmit: (origin?: SkillTrainerFeedbackOrigin) => void;
  RichContent?: SkillTrainerRichContentComponent;
}) {
  const plainExpression = content.expression ?? extractPlainTextFromDoc(content.question ?? null);
  const answerInputRef = useRef<HTMLInputElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (disabled || !answerFocused) return;
    answerInputRef.current?.focus();
  }, [answerFocused, disabled]);

  useEffect(() => {
    if (disabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || (event.code !== "KeyC" && event.key.toLowerCase() !== "c")) return;
      event.preventDefault();
      event.stopPropagation();
      if (answerFocused) {
        onCalcFocus();
      } else {
        onAnswerFocus();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [answerFocused, disabled, onAnswerFocus, onCalcFocus]);

  return (
    <div className="flex min-h-[calc(100vh-140px)] flex-col gap-4 md:flex-row">
      <article
        className={cn(
          "flex min-w-0 flex-1 cursor-text flex-col items-center gap-4 overflow-y-auto rounded-lg p-6 pt-24 text-center transition-colors",
          answerFocused ? "ring-2 ring-primary/30" : "",
        )}
        onClick={() => {
          onAnswerFocus();
          answerInputRef.current?.focus();
        }}
      >
        <div className="w-full max-w-lg">
          {hasProseMirrorContent(content.question) ? (
            <RichContent json={content.question} plainText={plainExpression} />
          ) : (
            <p className="text-2xl font-medium">{plainExpression}</p>
          )}
        </div>
        <div className="w-full max-w-sm space-y-3">
          <label className="block text-sm font-medium">Your answer</label>
          <div className="flex items-stretch gap-2">
            <Input
              ref={answerInputRef}
              type="number"
              step="any"
              value={value}
              disabled={disabled}
              onFocus={onAnswerFocus}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit(getElementCenter(submitButtonRef.current));
              }}
            />
            <Button
              ref={submitButtonRef}
              type="button"
              disabled={disabled || !value}
              onClick={() => onSubmit(getElementCenter(submitButtonRef.current))}
            >
              Submit
              <span className="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                Enter
              </span>
            </Button>
          </div>
        </div>
      </article>
      <div
        className={cn(
          "flex w-full flex-col gap-4 rounded-lg p-1 md:w-[320px] md:shrink-0",
          !answerFocused ? "ring-2 ring-primary/30" : "",
        )}
        onClick={onCalcFocus}
        onFocus={onCalcFocus}
      >
        <div>
          <EmbeddedCalculator
            display={calcDisplay}
            onKey={onCalcKey}
            onBackspace={() => onCalcKey("Backspace")}
            captureKeyboardAlways
            active={!answerFocused && !disabled}
          />
        </div>
        <p className="text-center text-xs text-muted-foreground">Alt+C switches input focus.</p>
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
  onSubmit: (origin?: SkillTrainerFeedbackOrigin) => void;
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
