"use client";

import React from "react";
import {
  AnswerExplanation,
  OptionText,
} from "@/features/question-engine/components/question-content";
import { cn } from "@/lib/utils";
import type { WrongAnswerInsightItem } from "../lib/question-insight-evidence";

function IncorrectLabel() {
  return (
    <span className="text-center text-xs font-medium leading-tight text-red-700 dark:text-red-400">
      Incorrect
    </span>
  );
}

function MultipleChoiceIncorrectAnswer({
  item,
}: {
  item: Extract<WrongAnswerInsightItem, { kind: "single_select" }>;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded bg-red-500/10 px-3 py-2">
      <div className="flex min-w-0 flex-1 items-start gap-2 text-sm">
        <span className="inline-block w-6 shrink-0 sm:w-8">{item.letter}.</span>
        <span className="min-w-0 flex-1">
          <OptionText option={item.option} textTone="theme" />
        </span>
      </div>
      <IncorrectLabel />
    </div>
  );
}

function PlacementIncorrectAnswer({
  item,
}: {
  item: Extract<WrongAnswerInsightItem, { kind: "placement" }>;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded bg-red-500/10 px-3 py-2">
      <div className="min-w-0 flex-1 text-sm">
        <OptionText option={item.option} textTone="theme" />
      </div>
      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <IncorrectLabel />
        <div className="flex h-9 min-w-20 items-center justify-center rounded-md border border-red-700 bg-red-50 px-2 text-sm font-medium text-red-800 dark:bg-red-950/40 dark:text-red-300">
          {item.chosenTokenLabel ?? "Not placed"}
        </div>
      </div>
    </div>
  );
}

export function WrongAnswerInsightList({
  items,
  className,
}: {
  items: readonly WrongAnswerInsightItem[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className={cn("space-y-4", className)}>
      {items.map((item) => (
        <div key={item.option.id} className="space-y-2">
          {item.kind === "single_select" ? (
            <MultipleChoiceIncorrectAnswer item={item} />
          ) : (
            <PlacementIncorrectAnswer item={item} />
          )}
          <AnswerExplanation
            text={item.option.answerExplanation}
            json={item.option.answerExplanationJson}
            textTone="theme"
          />
        </div>
      ))}
    </div>
  );
}
