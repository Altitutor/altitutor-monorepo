import React, {
  useEffect,
  useMemo,
  useState,
  type DragEventHandler,
} from "react";
import { Check } from "lucide-react";
import type {
  AnswerOption,
  QuestionItem,
} from "@/features/question-engine/model/types";
import {
  UCAT_COLORS,
  UCAT_FONTS,
} from "@altitutor/ui/components/ucat/ucat-theme";
import { RichContentBlock } from "./rich-content-block";
import type { CachedContent } from "@/features/question-engine/hooks/use-refreshed-content-cache";
import { cn } from "@/lib/utils";

export function hasAnswerExplanation(item: {
  answerExplanation?: string;
  answerExplanationJson?: Record<string, unknown> | null;
}): boolean {
  return Boolean(item.answerExplanation || item.answerExplanationJson);
}

type RichTextNodeLike = {
  type?: unknown;
  text?: unknown;
  content?: unknown;
};

function isWhitespaceNode(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const candidate = node as RichTextNodeLike;
  if (candidate.type === "hardBreak") return true;
  if (candidate.type === "text") {
    return typeof candidate.text === "string" && candidate.text.trim() === "";
  }
  if (Array.isArray(candidate.content)) {
    return candidate.content.every(isWhitespaceNode);
  }
  return false;
}

function isEmptyBlockNode(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const candidate = node as RichTextNodeLike;
  if (
    candidate.type !== "paragraph" &&
    candidate.type !== "hardBreak" &&
    candidate.type !== "text"
  ) {
    return false;
  }
  if (candidate.type === "hardBreak") return true;
  if (candidate.type === "text") {
    return typeof candidate.text === "string" && candidate.text.trim() === "";
  }
  if (!Array.isArray(candidate.content) || candidate.content.length === 0) {
    return true;
  }
  return candidate.content.every(isWhitespaceNode);
}

function trimTrailingWhitespaceFromNode(node: unknown): unknown {
  if (!node || typeof node !== "object") return node;
  const candidate = node as RichTextNodeLike;
  if (candidate.type === "text" && typeof candidate.text === "string") {
    return { ...candidate, text: candidate.text.trimEnd() };
  }
  if (!Array.isArray(candidate.content)) return node;

  const content = [...candidate.content];
  while (content.length > 0 && isWhitespaceNode(content[content.length - 1])) {
    content.pop();
  }
  if (content.length > 0) {
    content[content.length - 1] = trimTrailingWhitespaceFromNode(
      content[content.length - 1],
    );
  }
  return { ...candidate, content };
}

function trimTrailingExplanationWhitespace(
  json?: Record<string, unknown> | null,
): Record<string, unknown> | null | undefined {
  if (!json || !Array.isArray(json.content)) return json;
  const content = [...json.content];
  while (content.length > 0 && isEmptyBlockNode(content[content.length - 1])) {
    content.pop();
  }
  if (content.length > 0) {
    content[content.length - 1] = trimTrailingWhitespaceFromNode(
      content[content.length - 1],
    );
  }
  return { ...json, content };
}

export function AnswerExplanation({
  text,
  json,
  className,
  textTone = "engine",
}: {
  text?: string;
  json?: Record<string, unknown> | null;
  className?: string;
  textTone?: "engine" | "theme";
}) {
  const trimmedText = text?.trim();
  const trimmedJson = useMemo(
    () => trimTrailingExplanationWhitespace(json),
    [json],
  );

  if (
    !hasAnswerExplanation({
      answerExplanation: text,
      answerExplanationJson: json,
    })
  ) {
    return null;
  }

  return (
    <RichContentBlock
      json={trimmedJson}
      plainText={trimmedText ?? ""}
      className={className}
      textTone={textTone}
      paragraphSpacing
    />
  );
}

export function OptionText({
  option,
  textTone = "engine",
}: {
  option: AnswerOption;
  textTone?: "engine" | "theme";
}) {
  return (
    <RichContentBlock
      json={option.textJson}
      plainText={option.text}
      textTone={textTone}
      className="[&_.ProseMirror]:inline"
    />
  );
}

type QuestionContentProps = {
  question: QuestionItem;
  readOnly?: boolean;
  selectedOptionId?: string;
  onSelectOption: (optionId: string) => void;
  syllogismSnapshot?: Record<string, boolean>;
  onChangeSyllogismSnapshot?: (snapshot: Record<string, boolean>) => void;
  /** Pre-refreshed stem/question content for instant image display. */
  preloadedContent?: CachedContent | null;
  /** When true (e.g. in-exam review), show explanations when the question/options include them. */
  showAnswerExplanations?: boolean;
  highlightText?: string;
  syllogismDragOnly?: boolean;
  syllogismLockedOptionIds?: readonly string[];
  syllogismCorrectOptionIds?: readonly string[];
  onSyllogismClickAttempt?: () => void;
};

function SyllogismQuestionContent({
  question,
  readOnly = false,
  syllogismSnapshot,
  onChangeSyllogismSnapshot,
  preloadedContent,
  showAnswerExplanations,
  highlightText,
  syllogismDragOnly = false,
  syllogismLockedOptionIds = [],
  syllogismCorrectOptionIds = [],
  onSyllogismClickAttempt,
}: QuestionContentProps) {
  const isTwoColumn = question.sectionDisplayColumns === 2;
  const lockedOptionIds = useMemo(
    () => new Set(syllogismLockedOptionIds),
    [syllogismLockedOptionIds],
  );
  const correctOptionIds = useMemo(
    () => new Set(syllogismCorrectOptionIds),
    [syllogismCorrectOptionIds],
  );

  const [answers, setAnswers] = useState<Record<string, "yes" | "no">>(() => {
    const initial: Record<string, "yes" | "no"> = {};
    if (syllogismSnapshot) {
      for (const [optionId, value] of Object.entries(syllogismSnapshot)) {
        initial[optionId] = value ? "yes" : "no";
      }
    }
    return initial;
  });

  useEffect(() => {
    const restored: Record<string, "yes" | "no"> = {};
    for (const [optionId, value] of Object.entries(syllogismSnapshot ?? {})) {
      restored[optionId] = value ? "yes" : "no";
    }
    setAnswers(restored);
  }, [question.id, syllogismSnapshot]);

  const syncSnapshot = (next: Record<string, "yes" | "no">) => {
    if (!onChangeSyllogismSnapshot) return;
    const snapshot: Record<string, boolean> = {};
    for (const [optionId, choice] of Object.entries(next)) {
      snapshot[optionId] = choice === "yes";
    }
    onChangeSyllogismSnapshot(snapshot);
  };

  const handleAssign = (optionId: string, choice: "yes" | "no") => {
    if (readOnly || lockedOptionIds.has(optionId)) return;
    setAnswers((prev) => {
      const next = { ...prev, [optionId]: choice };
      syncSnapshot(next);
      return next;
    });
  };

  const makeHandleDrop =
    (optionId: string): DragEventHandler<HTMLDivElement> =>
    (event) => {
      event.preventDefault();
      if (readOnly || lockedOptionIds.has(optionId)) return;
      const choice = event.dataTransfer.getData("ucat-syllogism-choice") as
        | "yes"
        | "no"
        | "";
      if (choice !== "yes" && choice !== "no") return;

      const fromOptionId =
        event.dataTransfer.getData("ucat-syllogism-source") || null;

      setAnswers((prev) => {
        const next = { ...prev };
        if (fromOptionId && fromOptionId !== optionId) {
          delete next[fromOptionId];
        }
        next[optionId] = choice;
        syncSnapshot(next);
        return next;
      });
    };

  const handleDragOver: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
  };

  const handleTokenAreaDrop: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    if (readOnly) return;
    const fromOptionId =
      event.dataTransfer.getData("ucat-syllogism-source") || null;
    if (!fromOptionId) return;
    if (lockedOptionIds.has(fromOptionId)) return;

    setAnswers((prev) => {
      if (!prev[fromOptionId]) return prev;
      const next = { ...prev };
      delete next[fromOptionId];
      syncSnapshot(next);
      return next;
    });
  };

  const content = (
    <section className="space-y-4">
      <div className="font-medium text-[12pt]">
        <RichContentBlock
          json={question.questionJson}
          plainText={question.questionText}
          preloadedContent={preloadedContent?.question}
          highlightText={highlightText}
        />
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex-1 space-y-3">
          {question.options.map((option) => {
            const choice = answers[option.id] ?? null;
            const locked = readOnly || lockedOptionIds.has(option.id);
            const markedCorrect = correctOptionIds.has(option.id);
            return (
              <div
                key={option.id}
                data-syllogism-option-id={option.id}
                className="space-y-1"
              >
                <div className="flex flex-row items-stretch gap-4">
                  <div className="flex-1">
                    <div
                      className={cn(
                        "flex min-h-[50px] items-center justify-center rounded border bg-white px-4 text-center",
                        markedCorrect
                          ? "border-emerald-600 ring-2 ring-emerald-500/20"
                          : "border-[#000000]",
                      )}
                    >
                      <span className="whitespace-pre-wrap">
                        <OptionText option={option} />
                      </span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "flex h-12 w-24 items-center justify-center rounded border border-dashed text-[11pt] transition-colors",
                      markedCorrect
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                        : "border-[#4b5563] bg-slate-50",
                    )}
                    onDrop={makeHandleDrop(option.id)}
                    onDragOver={handleDragOver}
                    role="button"
                    tabIndex={0}
                    aria-disabled={locked}
                    aria-label="Drop Yes or No here"
                    onClick={
                      locked
                        ? undefined
                        : syllogismDragOnly
                          ? onSyllogismClickAttempt
                          : () =>
                              handleAssign(
                                option.id,
                                choice === "yes" ? "no" : "yes",
                              )
                    }
                  >
                    {choice ? (
                      <div
                        className={cn(
                          "flex h-9 w-20 items-center justify-center gap-1 rounded border bg-white text-[11pt] font-medium",
                          markedCorrect
                            ? "border-emerald-600 text-emerald-800"
                            : "border-black",
                        )}
                        draggable={!locked}
                        onDragStart={(event) => {
                          event.dataTransfer.setData(
                            "ucat-syllogism-choice",
                            choice,
                          );
                          event.dataTransfer.setData(
                            "ucat-syllogism-source",
                            option.id,
                          );
                          event.dataTransfer.effectAllowed = "move";
                        }}
                      >
                        {choice === "yes" ? "Yes" : "No"}
                        {markedCorrect ? (
                          <Check className="h-3.5 w-3.5" aria-hidden />
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-[9pt] text-transparent">_</span>
                    )}
                  </div>
                </div>
                {showAnswerExplanations && hasAnswerExplanation(option) ? (
                  <AnswerExplanation
                    text={option.answerExplanation}
                    json={option.answerExplanationJson}
                    className="pl-1"
                  />
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="mt-1 w-[139px] rounded border border-black bg-[#dfdfdf] px-2 py-2">
          <div
            className="flex h-full w-full flex-col items-center justify-start gap-2"
            onDrop={handleTokenAreaDrop}
            onDragOver={handleDragOver}
          >
            <button
              type="button"
              draggable={!readOnly}
              disabled={readOnly}
              onClick={syllogismDragOnly ? onSyllogismClickAttempt : undefined}
              onDragStart={(event) => {
                event.dataTransfer.setData("ucat-syllogism-choice", "yes");
                event.dataTransfer.setData("ucat-syllogism-source", "");
                event.dataTransfer.effectAllowed = "copy";
              }}
              className="flex h-9 w-20 items-center justify-center rounded border border-black bg-white text-[11pt] font-medium"
            >
              Yes
            </button>
            <button
              type="button"
              draggable={!readOnly}
              disabled={readOnly}
              onClick={syllogismDragOnly ? onSyllogismClickAttempt : undefined}
              onDragStart={(event) => {
                event.dataTransfer.setData("ucat-syllogism-choice", "no");
                event.dataTransfer.setData("ucat-syllogism-source", "");
                event.dataTransfer.effectAllowed = "copy";
              }}
              className="flex h-9 w-20 items-center justify-center rounded border border-black bg-white text-[11pt] font-medium"
            >
              No
            </button>
          </div>
        </div>
      </div>
      {showAnswerExplanations && hasAnswerExplanation(question) ? (
        <AnswerExplanation
          text={question.answerExplanation}
          json={question.answerExplanationJson}
          className="mt-3 border-t border-[#9ba9bd] pt-3 dark:border-border"
        />
      ) : null}
    </section>
  );

  if (isTwoColumn) {
    return (
      <div
        className={`flex h-full min-h-0 gap-4 font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed`}
      >
        <article
          data-tour="question-engine-stem"
          className="flex-[3] h-full min-w-0 overflow-y-auto border-r-[6px] pr-4 py-4 sm:py-5"
          style={{ borderRightColor: UCAT_COLORS.primaryBlue }}
        >
          <div className="space-y-3">
            <RichContentBlock
              json={question.stemJson}
              plainText={question.stemText}
              preloadedContent={preloadedContent?.stem}
              paragraphSpacing
              highlightText={highlightText}
            />
          </div>
        </article>
        <section
          data-tour="question-engine-question"
          className="flex-[2] h-full min-w-0 overflow-y-auto pl-2 pr-1 py-4 sm:py-5"
        >
          {content}
        </section>
      </div>
    );
  }

  return (
    <div
      className={`h-full overflow-auto font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed`}
    >
      <div className="space-y-4 py-4 sm:py-5">
        <article className="space-y-3">
          <RichContentBlock
            json={question.stemJson}
            plainText={question.stemText}
            preloadedContent={preloadedContent?.stem}
            paragraphSpacing
          />
        </article>
        {content}
      </div>
    </div>
  );
}

export function QuestionContent({
  question,
  readOnly = false,
  selectedOptionId,
  onSelectOption,
  syllogismSnapshot,
  onChangeSyllogismSnapshot,
  preloadedContent,
  showAnswerExplanations = false,
  highlightText,
  syllogismDragOnly,
  syllogismLockedOptionIds,
  syllogismCorrectOptionIds,
  onSyllogismClickAttempt,
}: QuestionContentProps) {
  const isTwoColumn = question.sectionDisplayColumns === 2;

  if (question.questionType === "syllogism") {
    return (
      <SyllogismQuestionContent
        question={question}
        readOnly={readOnly}
        selectedOptionId={selectedOptionId}
        onSelectOption={onSelectOption}
        syllogismSnapshot={syllogismSnapshot}
        onChangeSyllogismSnapshot={onChangeSyllogismSnapshot}
        preloadedContent={preloadedContent}
        showAnswerExplanations={showAnswerExplanations}
        highlightText={highlightText}
        syllogismDragOnly={syllogismDragOnly}
        syllogismLockedOptionIds={syllogismLockedOptionIds}
        syllogismCorrectOptionIds={syllogismCorrectOptionIds}
        onSyllogismClickAttempt={onSyllogismClickAttempt}
      />
    );
  }

  if (isTwoColumn) {
    return (
      <div
        className={`flex h-full min-h-0 gap-4 font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed`}
      >
        <article
          data-tour="question-engine-stem"
          className="flex-[3] h-full min-w-0 overflow-y-auto border-r-[6px] pr-4 py-4 sm:py-5"
          style={{ borderRightColor: UCAT_COLORS.primaryBlue }}
        >
          <div className="space-y-3">
            <RichContentBlock
              json={question.stemJson}
              plainText={question.stemText}
              preloadedContent={preloadedContent?.stem}
              paragraphSpacing
              highlightText={highlightText}
            />
          </div>
        </article>
        <section
          data-tour="question-engine-question"
          className="flex-[2] h-full min-w-0 overflow-y-auto pl-2 pr-1 py-4 sm:py-5"
        >
          <div className="space-y-3">
            <div className="font-medium text-[12pt]">
              <RichContentBlock
                json={question.questionJson}
                plainText={question.questionText}
                preloadedContent={preloadedContent?.question}
              />
            </div>
            <div className="space-y-2 pl-6">
              {question.options.map((option, index) => {
                const letter = String.fromCharCode(65 + index);
                return (
                  <div key={option.id} className="space-y-0.5">
                    <label
                      data-question-option-id={option.id}
                      className="flex items-start gap-2"
                    >
                      <input
                        type="radio"
                        name={question.id}
                        checked={selectedOptionId === option.id}
                        disabled={readOnly}
                        onChange={() => onSelectOption(option.id)}
                        className="mt-1 h-4 w-4"
                      />
                      <span className="flex">
                        <span className="inline-block w-8">{letter}.</span>
                        <span className="ml-4">
                          <OptionText option={option} />
                        </span>
                      </span>
                    </label>
                    {showAnswerExplanations && hasAnswerExplanation(option) ? (
                      <AnswerExplanation
                        text={option.answerExplanation}
                        json={option.answerExplanationJson}
                        className="ml-6"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
            {showAnswerExplanations && hasAnswerExplanation(question) ? (
              <AnswerExplanation
                text={question.answerExplanation}
                json={question.answerExplanationJson}
                className="mt-3 border-t border-[#9ba9bd] pt-3 dark:border-border"
              />
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      className={`h-full overflow-auto font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed`}
    >
      <div className="space-y-4 py-4 sm:py-5">
        <article data-tour="question-engine-stem" className="space-y-3">
          <RichContentBlock
            json={question.stemJson}
            plainText={question.stemText}
            preloadedContent={preloadedContent?.stem}
            paragraphSpacing
            highlightText={highlightText}
          />
        </article>
        <section data-tour="question-engine-question" className="space-y-3">
          <div className="font-medium text-[12pt]">
            <RichContentBlock
              json={question.questionJson}
              plainText={question.questionText}
              preloadedContent={preloadedContent?.question}
            />
          </div>
          <div className="space-y-2 pl-6">
            {question.options.map((option, index) => {
              const letter = String.fromCharCode(65 + index);
              return (
                <div key={option.id} className="space-y-0.5">
                  <label
                    data-question-option-id={option.id}
                    className="flex items-start gap-2"
                  >
                    <input
                      type="radio"
                      name={question.id}
                      checked={selectedOptionId === option.id}
                      disabled={readOnly}
                      onChange={() => onSelectOption(option.id)}
                      className="mt-1 h-4 w-4"
                    />
                    <span className="flex">
                      <span className="inline-block w-8">{letter}.</span>
                      <span className="ml-4">
                        <OptionText option={option} />
                      </span>
                    </span>
                  </label>
                  {showAnswerExplanations && hasAnswerExplanation(option) ? (
                    <AnswerExplanation
                      text={option.answerExplanation}
                      json={option.answerExplanationJson}
                      className="ml-6"
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
          {showAnswerExplanations && hasAnswerExplanation(question) ? (
            <AnswerExplanation
              text={question.answerExplanation}
              json={question.answerExplanationJson}
              className="mt-3 border-t border-[#9ba9bd] pt-3 dark:border-border"
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}
