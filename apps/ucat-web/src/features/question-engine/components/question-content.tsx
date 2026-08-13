import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import {
  applyPlacementTransition,
  type PlacementValue,
} from "@altitutor/ucat-response-contract";
import { placementPresentationForQuestion } from "@/features/question-engine/lib/response-state";

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
  placementSnapshot?: Record<string, PlacementValue>;
  onChangePlacementSnapshot?: (
    snapshot: Record<string, PlacementValue>,
  ) => void;
  /** Pre-refreshed stem/question content for instant image display. */
  preloadedContent?: CachedContent | null;
  /** When true (e.g. in-exam review), show explanations when the question/options include them. */
  showAnswerExplanations?: boolean;
  highlightText?: string;
  placementDragOnly?: boolean;
  placementLockedOptionIds?: readonly string[];
  placementCorrectOptionIds?: readonly string[];
  onPlacementClickAttempt?: () => void;
};

function PlacementQuestionContent({
  question,
  readOnly = false,
  placementSnapshot,
  onChangePlacementSnapshot,
  preloadedContent,
  showAnswerExplanations,
  highlightText,
  placementDragOnly = false,
  placementLockedOptionIds = [],
  placementCorrectOptionIds = [],
  onPlacementClickAttempt,
}: QuestionContentProps) {
  const presentation = placementPresentationForQuestion(question);
  const isTwoColumn =
    (presentation.displayColumnsOverride ?? question.sectionDisplayColumns) ===
    2;
  const [positiveToken, negativeToken] = presentation.tokens;
  if (!positiveToken || !negativeToken) {
    throw new Error("Placement responses require two presentation tokens.");
  }
  const lockedOptionIds = useMemo(
    () => new Set(placementLockedOptionIds),
    [placementLockedOptionIds],
  );
  const correctOptionIds = useMemo(
    () => new Set(placementCorrectOptionIds),
    [placementCorrectOptionIds],
  );

  const [answers, setAnswers] = useState<Record<string, PlacementValue>>(
    () => ({ ...placementSnapshot }),
  );
  const answersRef = useRef(answers);
  const touchDragRef = useRef<
    | {
        kind: "token";
        pointerId: number;
        choice: PlacementValue;
        sourceOptionId: string | null;
      }
    | { kind: "option"; pointerId: number; sourceOptionId: string }
    | null
  >(null);

  useEffect(() => {
    const next = { ...placementSnapshot };
    answersRef.current = next;
    setAnswers(next);
  }, [placementSnapshot, question.id]);

  const syncSnapshot = useCallback(
    (next: Record<string, PlacementValue>) => {
      onChangePlacementSnapshot?.(next);
    },
    [onChangePlacementSnapshot],
  );

  const commitAnswers = useCallback(
    (
      update: (
        previous: Record<string, PlacementValue>,
      ) => Record<string, PlacementValue>,
    ) => {
      const next = update(answersRef.current);
      answersRef.current = next;
      setAnswers(next);
      syncSnapshot(next);
    },
    [syncSnapshot],
  );

  const assignChoice = useCallback(
    (
      previous: Record<string, PlacementValue>,
      optionId: string,
      choice: PlacementValue,
      sourceOptionId: string | null,
    ): Record<string, PlacementValue> => ({
      ...applyPlacementTransition({
        presentation,
        placements: previous,
        targetId: optionId,
        token: choice,
        sourceId: sourceOptionId,
      }),
    }),
    [presentation],
  );

  const handleAssign = (optionId: string, choice: PlacementValue) => {
    if (readOnly || lockedOptionIds.has(optionId)) return;
    commitAnswers((previous) => assignChoice(previous, optionId, choice, null));
  };

  useEffect(() => {
    const finishTouchDrag = (event: PointerEvent) => {
      const drag = touchDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      touchDragRef.current = null;
      if (readOnly || placementDragOnly) return;

      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (drag.kind === "option") {
        const tokenElement = target?.closest<HTMLElement>(
          "[data-placement-token-value]",
        );
        const token = tokenElement?.dataset.placementTokenValue as
          | PlacementValue
          | undefined;
        if (
          token &&
          (token === positiveToken.value || token === negativeToken.value)
        ) {
          commitAnswers((previous) =>
            assignChoice(
              previous,
              drag.sourceOptionId,
              token,
              drag.sourceOptionId,
            ),
          );
        } else if (target?.closest("[data-placement-option-tray]")) {
          commitAnswers((previous) => {
            const next = { ...previous };
            delete next[drag.sourceOptionId];
            return next;
          });
        }
        return;
      }
      const optionElement = target?.closest<HTMLElement>(
        "[data-placement-option-id]",
      );
      const targetOptionId = optionElement?.dataset.placementOptionId;

      if (targetOptionId && !lockedOptionIds.has(targetOptionId)) {
        commitAnswers((previous) =>
          assignChoice(
            previous,
            targetOptionId,
            drag.choice,
            drag.sourceOptionId,
          ),
        );
        return;
      }

      if (
        drag.sourceOptionId &&
        target?.closest("[data-placement-token-area]") &&
        !lockedOptionIds.has(drag.sourceOptionId)
      ) {
        commitAnswers((previous) => {
          const next = { ...previous };
          delete next[drag.sourceOptionId!];
          return next;
        });
      }
    };

    window.addEventListener("pointerup", finishTouchDrag);
    window.addEventListener("pointercancel", finishTouchDrag);
    return () => {
      window.removeEventListener("pointerup", finishTouchDrag);
      window.removeEventListener("pointercancel", finishTouchDrag);
    };
  }, [
    assignChoice,
    commitAnswers,
    lockedOptionIds,
    negativeToken.value,
    positiveToken.value,
    readOnly,
    placementDragOnly,
  ]);

  const startTouchDrag = (
    event: React.PointerEvent,
    choice: PlacementValue,
    sourceOptionId: string | null,
  ) => {
    if (event.pointerType === "mouse" || readOnly) return;
    event.preventDefault();
    touchDragRef.current = {
      kind: "token",
      pointerId: event.pointerId,
      choice,
      sourceOptionId,
    };
  };

  const startOptionTouchDrag = (
    event: React.PointerEvent,
    sourceOptionId: string,
  ) => {
    if (event.pointerType === "mouse" || readOnly) return;
    event.preventDefault();
    touchDragRef.current = {
      kind: "option",
      pointerId: event.pointerId,
      sourceOptionId,
    };
  };

  const makeHandleDrop =
    (optionId: string): DragEventHandler<HTMLDivElement> =>
    (event) => {
      event.preventDefault();
      if (readOnly || lockedOptionIds.has(optionId)) return;
      const choice = event.dataTransfer.getData("ucat-placement-choice") as
        | PlacementValue
        | "";
      if (choice !== positiveToken.value && choice !== negativeToken.value)
        return;

      const fromOptionId =
        event.dataTransfer.getData("ucat-placement-source") || null;

      commitAnswers((previous) =>
        assignChoice(previous, optionId, choice, fromOptionId),
      );
    };

  const handleDragOver: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
  };

  const handleTokenAreaDrop: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    if (readOnly) return;
    const fromOptionId =
      event.dataTransfer.getData("ucat-placement-source") || null;
    if (!fromOptionId) return;
    if (lockedOptionIds.has(fromOptionId)) return;

    if (!answersRef.current[fromOptionId]) return;
    commitAnswers((previous) => {
      const next = { ...previous };
      delete next[fromOptionId];
      return next;
    });
  };

  const makeOptionDestinationDrop =
    (token: PlacementValue): DragEventHandler<HTMLDivElement> =>
    (event) => {
      event.preventDefault();
      if (readOnly) return;
      const optionId = event.dataTransfer.getData("ucat-placement-option");
      if (!optionId || !presentation.targetIds.includes(optionId)) return;
      commitAnswers((previous) =>
        assignChoice(previous, optionId, token, optionId),
      );
    };

  const handleOptionTrayDrop: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    if (readOnly) return;
    const optionId = event.dataTransfer.getData("ucat-placement-option");
    if (!optionId || !answersRef.current[optionId]) return;
    commitAnswers((previous) => {
      const next = { ...previous };
      delete next[optionId];
      return next;
    });
  };

  const optionById = useMemo(
    () => new Map(question.options.map((option) => [option.id, option])),
    [question.options],
  );

  const optionsToTokensContent = (
    <section data-tour="question-engine-question" className="space-y-5">
      <div className="font-medium text-[12pt]">
        <RichContentBlock
          json={question.questionJson}
          plainText={question.questionText}
          preloadedContent={preloadedContent?.question}
          highlightText={highlightText}
        />
      </div>
      <div className="max-w-4xl space-y-3">
        {presentation.tokens.map((token) => {
          const placedOptionId = Object.entries(answers).find(
            ([, value]) => value === token.value,
          )?.[0];
          const placedOption = placedOptionId
            ? optionById.get(placedOptionId)
            : undefined;
          return (
            <div
              key={token.value}
              className="flex items-stretch gap-3 sm:gap-5"
            >
              <div className="flex w-36 shrink-0 items-center justify-center rounded border border-black bg-white px-3 py-4 text-center font-medium sm:w-44">
                {token.label}
              </div>
              <div
                data-placement-token-value={token.value}
                className="flex min-h-[68px] flex-1 items-center justify-center rounded border border-black bg-[#d1cbcb] p-2"
                onDrop={makeOptionDestinationDrop(token.value)}
                onDragOver={handleDragOver}
                role="button"
                tabIndex={0}
                aria-label={`Drop an action into ${token.label}`}
              >
                {placedOption ? (
                  <div
                    className="flex min-h-[50px] w-full touch-none items-center justify-center rounded border border-black bg-white px-4 py-2 text-center"
                    draggable={!readOnly}
                    onPointerDown={(event) =>
                      startOptionTouchDrag(event, placedOption.id)
                    }
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        "ucat-placement-option",
                        placedOption.id,
                      );
                      event.dataTransfer.effectAllowed = "move";
                    }}
                  >
                    <OptionText option={placedOption} />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <div
        data-placement-option-tray
        className="max-w-3xl space-y-3 rounded bg-[#dfdfdf] p-5 sm:ml-12 sm:p-7"
        onDrop={handleOptionTrayDrop}
        onDragOver={handleDragOver}
      >
        {question.options
          .filter((option) => !answers[option.id])
          .map((option) => (
            <div
              key={option.id}
              className="flex min-h-[58px] touch-none items-center justify-center rounded border border-black bg-white px-4 py-2 text-center"
              draggable={!readOnly}
              onPointerDown={(event) => startOptionTouchDrag(event, option.id)}
              onDragStart={(event) => {
                event.dataTransfer.setData("ucat-placement-option", option.id);
                event.dataTransfer.effectAllowed = "move";
              }}
            >
              <OptionText option={option} />
            </div>
          ))}
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

  const tokensToOptionsContent = (
    <section data-tour="question-engine-question" className="space-y-4">
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
                data-placement-option-id={option.id}
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
                    aria-label={`Drop ${positiveToken.label} or ${negativeToken.label} here`}
                    onClick={
                      locked
                        ? undefined
                        : placementDragOnly ||
                            presentation.reuse === "once_each"
                          ? onPlacementClickAttempt
                          : () =>
                              handleAssign(
                                option.id,
                                choice === positiveToken.value
                                  ? negativeToken.value
                                  : positiveToken.value,
                              )
                    }
                  >
                    {choice ? (
                      <div
                        className={cn(
                          "flex h-9 w-20 touch-none items-center justify-center gap-1 rounded border bg-white text-[11pt] font-medium",
                          markedCorrect
                            ? "border-emerald-600 text-emerald-800"
                            : "border-black",
                        )}
                        draggable={!locked}
                        onPointerDown={(event) =>
                          startTouchDrag(event, choice, option.id)
                        }
                        onDragStart={(event) => {
                          event.dataTransfer.setData(
                            "ucat-placement-choice",
                            choice,
                          );
                          event.dataTransfer.setData(
                            "ucat-placement-source",
                            option.id,
                          );
                          event.dataTransfer.effectAllowed = "move";
                        }}
                      >
                        {choice === positiveToken.value
                          ? positiveToken.label
                          : negativeToken.label}
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
            data-placement-token-area
            className="flex h-full w-full flex-col items-center justify-start gap-2"
            onDrop={handleTokenAreaDrop}
            onDragOver={handleDragOver}
          >
            <button
              type="button"
              draggable={!readOnly}
              onPointerDown={(event) =>
                startTouchDrag(event, positiveToken.value, null)
              }
              disabled={
                readOnly ||
                (presentation.reuse === "once_each" &&
                  Object.values(answers).includes(positiveToken.value))
              }
              onClick={placementDragOnly ? onPlacementClickAttempt : undefined}
              onDragStart={(event) => {
                event.dataTransfer.setData(
                  "ucat-placement-choice",
                  positiveToken.value,
                );
                event.dataTransfer.setData("ucat-placement-source", "");
                event.dataTransfer.effectAllowed = "copy";
              }}
              className="flex h-9 w-20 touch-none items-center justify-center rounded border border-black bg-white text-[11pt] font-medium"
            >
              {positiveToken.label}
            </button>
            <button
              type="button"
              draggable={!readOnly}
              onPointerDown={(event) =>
                startTouchDrag(event, negativeToken.value, null)
              }
              disabled={
                readOnly ||
                (presentation.reuse === "once_each" &&
                  Object.values(answers).includes(negativeToken.value))
              }
              onClick={placementDragOnly ? onPlacementClickAttempt : undefined}
              onDragStart={(event) => {
                event.dataTransfer.setData(
                  "ucat-placement-choice",
                  negativeToken.value,
                );
                event.dataTransfer.setData("ucat-placement-source", "");
                event.dataTransfer.effectAllowed = "copy";
              }}
              className="flex h-9 w-20 touch-none items-center justify-center rounded border border-black bg-white text-[11pt] font-medium"
            >
              {negativeToken.label}
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

  const content =
    presentation.dragDirection === "options_to_tokens"
      ? optionsToTokensContent
      : tokensToOptionsContent;

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
        <div className="flex-[2] h-full min-w-0 overflow-y-auto pl-2 pr-1 py-4 sm:py-5">
          {content}
        </div>
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
  placementSnapshot,
  onChangePlacementSnapshot,
  preloadedContent,
  showAnswerExplanations = false,
  highlightText,
  placementDragOnly,
  placementLockedOptionIds,
  placementCorrectOptionIds,
  onPlacementClickAttempt,
}: QuestionContentProps) {
  const isTwoColumn = question.sectionDisplayColumns === 2;

  if (question.responseType === "drag_and_drop") {
    return (
      <PlacementQuestionContent
        question={question}
        readOnly={readOnly}
        selectedOptionId={selectedOptionId}
        onSelectOption={onSelectOption}
        placementSnapshot={placementSnapshot}
        onChangePlacementSnapshot={onChangePlacementSnapshot}
        preloadedContent={preloadedContent}
        showAnswerExplanations={showAnswerExplanations}
        highlightText={highlightText}
        placementDragOnly={placementDragOnly}
        placementLockedOptionIds={placementLockedOptionIds}
        placementCorrectOptionIds={placementCorrectOptionIds}
        onPlacementClickAttempt={onPlacementClickAttempt}
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
            <div className="space-y-2 pl-0 sm:pl-6">
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
                      <span className="flex min-w-0">
                        <span className="inline-block w-6 shrink-0 sm:w-8">
                          {letter}.
                        </span>
                        <span className="ml-0 min-w-0 sm:ml-4">
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
          <div className="space-y-2 pl-0 sm:pl-6">
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
                    <span className="flex min-w-0">
                      <span className="inline-block w-6 shrink-0 sm:w-8">
                        {letter}.
                      </span>
                      <span className="ml-0 min-w-0 sm:ml-4">
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
