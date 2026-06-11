"use client";

import type { UcatSkillTrainerKey } from "@altitutor/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalculatorMathsTrainer,
  FindConceptTrainer,
  FindWordTrainer,
  MentalMathsTrainer,
  NumpadTrainer,
  QuickSyllogismTrainer,
  type SkillTrainerRichContentComponent,
} from "./trainers";

function noop() {
  /* preview */
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toFindWordContent(raw: Record<string, unknown>) {
  return {
    passage: asRecord(raw.passage),
    keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
  };
}

function toFindConceptContent(raw: Record<string, unknown>) {
  return {
    passage: asRecord(raw.passage),
    concept: typeof raw.concept === "string" ? raw.concept : "",
    occurrences: Array.isArray(raw.occurrences) ? raw.occurrences : [],
  };
}

function toQuickSyllogismContent(raw: Record<string, unknown>) {
  return {
    statement: typeof raw.statement === "string" ? raw.statement : "",
    answer: typeof raw.answer === "boolean" ? raw.answer : true,
  };
}

function toMentalMathsContent(raw: Record<string, unknown>) {
  return {
    expression: typeof raw.expression === "string" ? raw.expression : "",
    answer: typeof raw.answer === "number" ? raw.answer : 0,
  };
}

function toNumpadSpeedContent(raw: Record<string, unknown>) {
  return {
    button_sequence: Array.isArray(raw.button_sequence)
      ? raw.button_sequence.filter((v): v is string => typeof v === "string")
      : [],
    label: typeof raw.label === "string" ? raw.label : undefined,
  };
}

function toCalculatorMathsContent(raw: Record<string, unknown>) {
  return {
    question: raw.question ? asRecord(raw.question) : undefined,
    expression: typeof raw.expression === "string" ? raw.expression : undefined,
    answer: typeof raw.answer === "number" ? raw.answer : 0,
  };
}

/** Local calculator display for preview (keys update display only). */
function usePreviewCalculator() {
  const [display, setDisplay] = useState("0");

  const onCalcKey = useCallback((key: string) => {
    setDisplay((prev) => {
      if (key === "ON/C" || key === "C") return "0";
      if (/^[0-9.]$/.test(key)) return prev === "0" ? key : prev + key;
      return prev + key;
    });
  }, []);

  const reset = useCallback(() => setDisplay("0"), []);

  return { display, onCalcKey, reset };
}

export function SkillTrainerItemPreview({
  trainerKey,
  content,
  contentKey,
  RichContent,
  showAnswer = false,
}: {
  trainerKey: UcatSkillTrainerKey;
  content: Record<string, unknown>;
  /** Bust local preview state when the edited item changes. */
  contentKey?: string;
  RichContent?: SkillTrainerRichContentComponent;
  showAnswer?: boolean;
}) {
  const [placedIds, setPlacedIds] = useState<string[]>([]);
  const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(null);
  const [draggingKeywordId, setDraggingKeywordId] = useState<string | null>(null);
  const [foundIndexes, setFoundIndexes] = useState<number[]>([]);
  const [numericInput, setNumericInput] = useState("");
  const [numpadInput, setNumpadInput] = useState<string[]>([]);
  const [answerFocused, setAnswerFocused] = useState(false);
  const { display: calcDisplay, onCalcKey, reset: resetCalc } = usePreviewCalculator();

  useEffect(() => {
    setPlacedIds([]);
    setSelectedKeywordId(null);
    setDraggingKeywordId(null);
    setFoundIndexes([]);
    setNumericInput(showAnswer ? String(content.answer ?? "") : "");
    setNumpadInput([]);
    setAnswerFocused(false);
    resetCalc();
  }, [contentKey, trainerKey, showAnswer, content.answer, resetCalc]);

  const previewDisabled = false;

  const findWordContent = useMemo(() => toFindWordContent(content), [content]);
  const findConceptContent = useMemo(() => toFindConceptContent(content), [content]);
  const syllogismContent = useMemo(() => toQuickSyllogismContent(content), [content]);
  const mentalMathsContent = useMemo(() => toMentalMathsContent(content), [content]);
  const numpadContent = useMemo(() => toNumpadSpeedContent(content), [content]);
  const calculatorMathsContent = useMemo(() => toCalculatorMathsContent(content), [content]);

  switch (trainerKey) {
    case "find_word":
      return (
        <FindWordTrainer
          content={findWordContent}
          placedIds={placedIds}
          selectedKeywordId={selectedKeywordId}
          draggingKeywordId={draggingKeywordId}
          onSelectKeyword={setSelectedKeywordId}
          onDragKeyword={setDraggingKeywordId}
          disabled={previewDisabled}
          onPlace={(keywordId) => {
            setPlacedIds((prev) => (prev.includes(keywordId) ? prev : [...prev, keywordId]));
            setSelectedKeywordId(null);
            setDraggingKeywordId(null);
          }}
        />
      );
    case "find_concept":
      return (
        <FindConceptTrainer
          content={findConceptContent}
          foundIndexes={foundIndexes}
          disabled={previewDisabled}
          onClickOccurrence={(index) => {
            setFoundIndexes((prev) => (prev.includes(index) ? prev : [...prev, index]));
          }}
          onSubmit={noop}
        />
      );
    case "quick_syllogism":
      return (
        <QuickSyllogismTrainer
          content={syllogismContent}
          disabled={previewDisabled}
          onAnswer={noop}
        />
      );
    case "mental_maths":
      return (
        <div className="relative">
          <MentalMathsTrainer
            content={mentalMathsContent}
            value={numericInput}
            inputKey={contentKey ?? "mental"}
            onChange={setNumericInput}
            disabled={previewDisabled}
            onSubmit={noop}
          />
          {showAnswer ? (
            <p className="px-6 pb-4 text-center text-sm text-muted-foreground">
              Answer: {mentalMathsContent.answer}
            </p>
          ) : null}
        </div>
      );
    case "numpad_speed":
      return (
        <NumpadTrainer
          content={numpadContent}
          sequence={numpadInput}
          onCalcKey={(key) => {
            if (key === "=") return;
            setNumpadInput((prev) => [...prev, key]);
          }}
          onRemoveKey={(index) => {
            setNumpadInput((prev) => prev.filter((_, i) => i !== index));
          }}
          onSubmit={noop}
          disabled={previewDisabled}
        />
      );
    case "calculator_maths":
      return (
        <div className="relative">
          <CalculatorMathsTrainer
            content={calculatorMathsContent}
            value={numericInput}
            calcDisplay={calcDisplay}
            answerFocused={answerFocused}
            onAnswerFocus={() => setAnswerFocused(true)}
            onCalcFocus={() => setAnswerFocused(false)}
            onChange={setNumericInput}
            onCalcKey={onCalcKey}
            disabled={previewDisabled}
            onSubmit={noop}
            RichContent={RichContent}
          />
          {showAnswer ? (
            <p className="px-6 pb-4 text-center text-sm text-muted-foreground">
              Answer: {calculatorMathsContent.answer}
            </p>
          ) : null}
        </div>
      );
    default:
      return null;
  }
}
