"use client";

import React, { useEffect, useState } from "react";
import {
  UCAT_COLORS,
  UCAT_FONTS,
} from "@altitutor/ui/components/ucat/ucat-theme";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import type {
  AnswerOption,
  PlacementSnapshot,
  QuestionItem,
} from "@/features/question-engine/model/types";
import type { CachedContent } from "@/features/question-engine/hooks/use-refreshed-content-cache";
import { cn } from "@/lib/utils";
import { RichContentBlock } from "./rich-content-block";
import {
  AnswerExplanation,
  hasAnswerExplanation,
  OptionText,
} from "./question-content";
import {
  projectPlacementReviewByDestination,
  type PresentationContract,
  type ReviewContract,
} from "@altitutor/ucat-response-contract";
import {
  evaluatePersistedQuestionResponse,
  getQuestionMaximumMarks,
  isPlacementResponse,
  placementPresentationForQuestion,
  snapshotQuestionResponse,
} from "@/features/question-engine/lib/response-state";

type ResultsViewerVariant = "ucat" | "site";

const MIN_ANSWER_DISTRIBUTION_SAMPLE_SIZE = 2;

function getResultsViewerTheme(variant: ResultsViewerVariant) {
  const site = variant === "site";
  return {
    site,
    body: site
      ? "text-sm leading-relaxed"
      : `font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed`,
    scrollRoot: site ? "" : "h-full overflow-auto",
    twoColumnRoot: cn(
      "flex gap-4",
      site ? "sm:gap-6" : "h-full min-h-0",
      site
        ? "text-sm leading-relaxed"
        : `font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed`,
    ),
    stemColumn: cn(
      "flex-[3] min-w-0 pr-4 py-4 sm:py-5",
      site ? "border-r border-border" : "h-full overflow-y-auto border-r-[6px]",
    ),
    questionColumn: cn(
      "flex-[2] min-w-0 pl-2 pr-1 py-4 sm:py-5",
      !site && "h-full overflow-y-auto",
    ),
    gridHeader: site
      ? "text-xs font-medium text-muted-foreground"
      : "text-[10pt] font-medium text-[#4b5563]",
    statementBox: site
      ? "flex min-h-[50px] w-full items-center justify-center rounded-md border border-border bg-card px-4 text-center"
      : "flex min-h-[50px] w-full items-center justify-center rounded border border-[#000000] bg-white px-4 text-center",
    correctAnswerBox: site
      ? "flex h-9 w-20 items-center justify-center rounded-md border border-border bg-card text-sm font-medium"
      : "flex h-9 w-20 items-center justify-center rounded border border-black bg-white text-[11pt] font-medium",
    footer: site
      ? "mt-3 space-y-1 border-t border-border pt-3 text-sm leading-relaxed"
      : "mt-3 space-y-1 border-t border-[#9ba9bd] pt-3 dark:border-border",
    questionPrompt: site ? "font-medium text-base" : "font-medium text-[12pt]",
    correctRowBg: site ? "bg-green-500/10" : "bg-green-100",
    wrongRowBg: site ? "bg-red-500/10" : "bg-red-100",
    statsBarBg: site ? "bg-muted" : "bg-[#e8ecf0]",
    labelSize: site ? "text-xs" : "text-[10pt]",
  };
}

function StudentStatsBar({
  pct,
  barWidth,
  hasStats,
  variant,
}: {
  pct: number;
  barWidth: number;
  hasStats: boolean;
  variant: ResultsViewerVariant;
}) {
  if (!hasStats) return null;

  const site = variant === "site";
  const roundedPct = Math.round(pct);
  const displayPct = `${roundedPct}%`;
  const tooltipLabel = `${roundedPct}% of Altitutor students selected this option`;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="flex w-28 shrink-0 cursor-help items-center justify-end gap-2"
            aria-label={tooltipLabel}
          >
            <div
              className={cn(
                "h-2.5 w-16 overflow-hidden rounded-full",
                site ? "bg-muted" : "bg-[#e8ecf0]",
              )}
              aria-hidden="true"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  site && "bg-primary",
                )}
                style={{
                  width: `${barWidth}%`,
                  ...(site ? {} : { backgroundColor: UCAT_COLORS.toolbarBlue }),
                }}
              />
            </div>
            <span
              className={cn(
                "w-8 text-right font-medium tabular-nums",
                site ? "text-xs" : "text-[10pt]",
                site ? "text-foreground" : undefined,
              )}
              style={
                site
                  ? undefined
                  : {
                      color: "#1f2937",
                    }
              }
            >
              {displayPct}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px]">
          {tooltipLabel}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function getPointsColorClass(scored: number, maxPoints: number): string {
  if (scored <= 0) return "text-red-700 dark:text-red-400";
  if (scored >= maxPoints) return "text-green-700 dark:text-green-400";
  return "text-amber-700 dark:text-amber-400";
}

function QuestionPointsFooter({
  points,
  question,
}: {
  points: number;
  question: QuestionItem;
}) {
  const maxPoints = getQuestionMaximumMarks(question);
  const scored = points;
  const formattedPoints = Number.isInteger(scored)
    ? String(scored)
    : scored.toFixed(1);

  return (
    <div className="font-medium">
      <span className={getPointsColorClass(scored, maxPoints)}>
        Points: {formattedPoints} / {maxPoints}
      </span>
    </div>
  );
}

const placementAnswerWrongClass = (site: boolean) =>
  site
    ? "border-red-700 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
    : "border-red-700 bg-red-50 text-red-800";

const placementAnswerCorrectClass = (site: boolean) =>
  site
    ? "border-green-700 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300"
    : "border-green-700 bg-green-50 text-green-800";

function DestinationFirstPlacementReview({
  options,
  presentation,
  review,
  theme,
  textTone,
  showExplanations,
}: {
  options: readonly AnswerOption[];
  presentation: Extract<PresentationContract, { kind: "placement" }>;
  review: Extract<ReviewContract, { kind: "placement" }>;
  theme: ReturnType<typeof getResultsViewerTheme>;
  textTone: "theme" | "engine";
  showExplanations: boolean;
}) {
  const optionById = new Map(options.map((option) => [option.id, option]));
  const destinations = projectPlacementReviewByDestination(
    presentation,
    review,
  );

  return (
    <div className="mt-3 space-y-1.5">
      <div
        className={cn(
          "grid grid-cols-[minmax(0,1.25fr)_minmax(0,3fr)_minmax(0,3fr)] gap-x-2 px-3",
          theme.gridHeader,
        )}
      >
        <div>Destination</div>
        <div className="text-center">Your answer</div>
        <div className="text-center">Correct answer</div>
      </div>
      <div className="space-y-1.5">
        {destinations.map((destination) => {
          const isCorrect = destination.outcome === "correct";
          const selectedOptions = destination.selectedTargetIds
            .map((id) => optionById.get(id))
            .filter((option): option is AnswerOption => option != null);
          const correctOptions = destination.correctTargetIds
            .map((id) => optionById.get(id))
            .filter((option): option is AnswerOption => option != null);

          return (
            <div
              key={destination.token ?? "not-placed"}
              data-testid={`placement-destination-${destination.token ?? "not-placed"}`}
              className={cn(
                "grid grid-cols-[minmax(0,1.25fr)_minmax(0,3fr)_minmax(0,3fr)] items-stretch gap-2 rounded px-3 py-1",
                isCorrect ? theme.correctRowBg : theme.wrongRowBg,
              )}
            >
              <div className="flex min-h-[50px] items-center font-medium">
                {destination.label}
              </div>
              <div
                className={cn(
                  "flex min-h-[50px] flex-col items-center justify-center gap-1 rounded-md border px-4 text-center",
                  theme.site ? "text-sm" : "text-[11pt]",
                  selectedOptions.length === 0
                    ? "border-dashed border-muted-foreground/50 text-muted-foreground"
                    : isCorrect
                      ? "border-green-600/50 bg-green-500/10 dark:border-green-700/50"
                      : "border-red-600/50 bg-red-500/10 dark:border-red-700/50",
                )}
              >
                {selectedOptions.length === 0
                  ? "—"
                  : selectedOptions.map((option) => (
                      <OptionText
                        key={option.id}
                        option={option}
                        textTone={textTone}
                      />
                    ))}
              </div>
              <div className={theme.statementBox}>
                {correctOptions.map((option) => (
                  <OptionText
                    key={option.id}
                    option={option}
                    textTone={textTone}
                  />
                ))}
              </div>
              {showExplanations && correctOptions.some(hasAnswerExplanation) ? (
                <div className="col-span-3 pl-1">
                  {correctOptions.filter(hasAnswerExplanation).map((option) => (
                    <AnswerExplanation
                      key={option.id}
                      text={option.answerExplanation}
                      json={option.answerExplanationJson}
                      textTone={textTone}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ResultsQuestionViewer({
  question,
  selectedOptionId,
  correctOptionId,
  points,
  placementSnapshot,
  review,
  preloadedContent,
  variant = "ucat",
  showExplanations = true,
  forceSingleColumn = false,
}: {
  question: QuestionItem;
  selectedOptionId?: string;
  correctOptionId?: string;
  points?: number;
  placementSnapshot?: PlacementSnapshot;
  /** Canonical evaluator projection; computed here only when a caller has not supplied it. */
  review?: ReviewContract;
  /** Pre-refreshed stem/question content for instant image display. */
  preloadedContent?: CachedContent | null;
  /** `site` uses app theme (progress attempt review); `ucat` matches exam engine styling. */
  variant?: ResultsViewerVariant;
  showExplanations?: boolean;
  forceSingleColumn?: boolean;
}) {
  const theme = getResultsViewerTheme(variant);
  const contentTextTone = variant === "site" ? "theme" : "engine";
  const showQuestionFooter =
    typeof points === "number" ||
    (showExplanations && hasAnswerExplanation(question));
  const isTwoColumn =
    !forceSingleColumn && question.sectionDisplayColumns === 2;

  const optionLabel = (index: number) => String.fromCharCode(65 + index);
  const [animateBars, setAnimateBars] = useState(false);
  const projectedReview =
    review ??
    evaluatePersistedQuestionResponse(
      question,
      snapshotQuestionResponse(question, selectedOptionId, placementSnapshot),
    ).review;

  useEffect(() => {
    // Trigger bar animation when question changes
    setAnimateBars(false);
    const id = window.setTimeout(() => setAnimateBars(true), 0);
    return () => window.clearTimeout(id);
  }, [question.id]);

  if (isPlacementResponse(question)) {
    const options = [...question.options].sort((a, b) => a.index - b.index);
    const presentation = placementPresentationForQuestion(question);
    const tokenLabel = new Map(
      presentation.tokens.map((token) => [token.value, token.label]),
    );

    const rows = options.map((opt) => {
      const projectedRow =
        projectedReview.kind === "placement"
          ? projectedReview.rows.find((row) => row.targetId === opt.id)
          : undefined;
      const studentToken = projectedRow?.placedToken ?? null;
      const correctToken = projectedRow?.correctToken ?? null;
      const isCorrect = studentToken === correctToken;

      const hasStats =
        opt.totalAnswered != null &&
        opt.totalAnswered >= MIN_ANSWER_DISTRIBUTION_SAMPLE_SIZE;
      const pct = hasStats ? Math.max(0, opt.percentage ?? 0) : 0;
      const barWidth = animateBars ? Math.min(100, pct) : 0;

      return {
        option: opt,
        studentToken,
        correctToken,
        isCorrect,
        hasStats,
        pct,
        barWidth,
      };
    });

    const isAttemptReview = variant === "site" && typeof points === "number";
    const savedAnswersUnavailable =
      isAttemptReview &&
      points != null &&
      points > 0 &&
      placementSnapshot == null;
    const isReviewingPlacement = placementSnapshot != null;
    const showStudentsColumn = rows.some((row) => row.hasStats);
    const placementGridCols = showStudentsColumn
      ? "grid-cols-[minmax(0,3fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1.2fr)]"
      : "grid-cols-[minmax(0,3fr)_minmax(0,1.4fr)_minmax(0,1.4fr)]";
    const isDestinationFirst =
      presentation.dragDirection === "options_to_tokens" &&
      projectedReview.kind === "placement";

    const content = (
      <div
        className={cn(
          "space-y-4",
          theme.site ? "pt-4 sm:pt-5" : "py-4 sm:py-5",
        )}
      >
        <article className="space-y-3">
          <RichContentBlock
            json={question.stemJson}
            plainText={question.stemText}
            preloadedContent={preloadedContent?.stem}
            textTone={contentTextTone}
            paragraphSpacing
          />
        </article>
        <section className="space-y-3">
          <div className={theme.questionPrompt}>
            <RichContentBlock
              json={question.questionJson}
              plainText={question.questionText}
              preloadedContent={preloadedContent?.question}
              textTone={contentTextTone}
            />
          </div>
          {savedAnswersUnavailable ? (
            <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              This attempt was scored, but its individual placement answers were
              not saved. New placement attempts retain these answers.
            </p>
          ) : null}
          {isDestinationFirst && projectedReview.kind === "placement" ? (
            <DestinationFirstPlacementReview
              options={options}
              presentation={presentation}
              review={projectedReview}
              theme={theme}
              textTone={contentTextTone}
              showExplanations={showExplanations}
            />
          ) : (
          <div className="mt-3 space-y-1.5">
            <div
              className={cn(
                "grid gap-x-1 gap-y-0.5 pl-4 pr-3",
                placementGridCols,
                theme.gridHeader,
              )}
            >
              <div>Statement</div>
              <div className="text-center">Your answers</div>
              <div className="text-center">Correct answers</div>
              {showStudentsColumn ? (
                <div className="text-center">Students</div>
              ) : null}
            </div>
            <div className="space-y-1">
              {rows.map(
                ({
                  option,
                  studentToken,
                  correctToken,
                  isCorrect,
                  hasStats,
                  pct,
                  barWidth,
                }) => {
                  const rowHighlight = isReviewingPlacement
                    ? isCorrect
                      ? "correct"
                      : "wrong"
                    : null;
                  const rowBgClass =
                    rowHighlight === "correct"
                      ? theme.correctRowBg
                      : rowHighlight === "wrong"
                        ? theme.wrongRowBg
                        : "";

                  return (
                    <div
                      key={option.id}
                      className={cn(
                        "grid items-stretch gap-x-1 gap-y-1 rounded py-0.5 pl-4 pr-3",
                        placementGridCols,
                        rowBgClass,
                      )}
                    >
                      <div className="flex items-center">
                        <div
                          className={cn(
                            "flex min-h-[50px] w-full items-center justify-center rounded-md border px-4 text-center",
                            theme.site ? "text-sm" : "text-[11pt]",
                            rowHighlight === "correct"
                              ? cn(
                                  theme.correctRowBg,
                                  "border-green-600/50 dark:border-green-700/50",
                                )
                              : rowHighlight === "wrong"
                                ? cn(
                                    theme.wrongRowBg,
                                    "border-red-600/50 dark:border-red-700/50",
                                  )
                                : theme.statementBox,
                          )}
                        >
                          <span className="whitespace-pre-wrap">
                            <OptionText
                              option={option}
                              textTone={contentTextTone}
                            />
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-center">
                        <div
                          className={cn(
                            "flex h-9 w-20 items-center justify-center rounded border font-medium",
                            theme.site ? "text-sm" : "text-[11pt]",
                            rowHighlight === "correct"
                              ? placementAnswerCorrectClass(theme.site)
                              : rowHighlight === "wrong"
                                ? placementAnswerWrongClass(theme.site)
                                : studentToken == null
                                  ? theme.site
                                    ? "border-dashed border-muted-foreground/50 text-muted-foreground"
                                    : "border-dashed border-[#9ca3af] text-[#9ca3af]"
                                  : isCorrect
                                    ? placementAnswerCorrectClass(theme.site)
                                    : placementAnswerWrongClass(theme.site),
                          )}
                        >
                          {studentToken == null
                            ? "—"
                            : (tokenLabel.get(studentToken) ?? studentToken)}
                        </div>
                      </div>
                      <div className="flex items-center justify-center">
                        <div className={theme.correctAnswerBox}>
                          {correctToken == null
                            ? "Not placed"
                            : (tokenLabel.get(correctToken) ?? correctToken)}
                        </div>
                      </div>
                      {showStudentsColumn ? (
                        <div className="flex items-center justify-center">
                          <StudentStatsBar
                            pct={pct}
                            barWidth={barWidth}
                            hasStats={hasStats}
                            variant={variant}
                          />
                        </div>
                      ) : null}
                      {showExplanations && hasAnswerExplanation(option) ? (
                        <div
                          className={cn(
                            "pl-1",
                            showStudentsColumn ? "col-span-4" : "col-span-3",
                          )}
                        >
                          <AnswerExplanation
                            text={option.answerExplanation}
                            json={option.answerExplanationJson}
                            textTone={contentTextTone}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                },
              )}
            </div>
          </div>
          )}
          {showQuestionFooter ? (
            <div className={theme.footer}>
              {typeof points === "number" ? (
                <QuestionPointsFooter points={points} question={question} />
              ) : null}
              {showExplanations && hasAnswerExplanation(question) ? (
                <AnswerExplanation
                  text={question.answerExplanation}
                  json={question.answerExplanationJson}
                  textTone={contentTextTone}
                />
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    );

    if (isTwoColumn) {
      return (
        <div className={theme.twoColumnRoot}>
          <article
            className={theme.stemColumn}
            style={
              theme.site
                ? undefined
                : { borderRightColor: UCAT_COLORS.primaryBlue }
            }
          >
            <div className="space-y-3">
              <RichContentBlock
                json={question.stemJson}
                plainText={question.stemText}
                preloadedContent={preloadedContent?.stem}
                textTone={contentTextTone}
                paragraphSpacing
              />
            </div>
          </article>
          <section className={theme.questionColumn}>{content}</section>
        </div>
      );
    }

    return <div className={cn(theme.body, theme.scrollRoot)}>{content}</div>;
  }

  const singleSelectReview =
    projectedReview.kind === "single_select" ? projectedReview : null;
  const projectedSelectedOptionId =
    singleSelectReview?.selectedOptionId ?? selectedOptionId;
  const projectedCorrectOptionId =
    singleSelectReview?.correctOptionId ?? correctOptionId;
  const answeredIncorrectly =
    projectedCorrectOptionId != null &&
    projectedSelectedOptionId !== projectedCorrectOptionId;

  const renderOption = (option: AnswerOption, index: number) => {
    const optionIsCorrect = option.id === projectedCorrectOptionId;
    const optionIsSelected = option.id === projectedSelectedOptionId;
    const optionIsWrongSelection =
      answeredIncorrectly &&
      optionIsSelected &&
      !optionIsCorrect &&
      singleSelectReview?.outcome !== "partial";
    const optionIsPartialSelection =
      optionIsSelected && singleSelectReview?.outcome === "partial";
    const letter = optionLabel(index);
    const hasStats =
      option.totalAnswered != null &&
      option.totalAnswered >= MIN_ANSWER_DISTRIBUTION_SAMPLE_SIZE;
    const pct = hasStats ? Math.max(0, option.percentage ?? 0) : 0;
    const barWidth = animateBars ? Math.min(100, pct) : 0;

    const bgClass = optionIsCorrect
      ? theme.correctRowBg
      : optionIsPartialSelection
        ? "bg-amber-100 dark:bg-amber-950/40"
        : optionIsWrongSelection
          ? theme.wrongRowBg
          : "";

    const label = optionIsCorrect
      ? {
          text: answeredIncorrectly ? "Correct answer" : "Correct",
          color: "text-green-700 dark:text-green-400",
        }
      : optionIsPartialSelection
        ? {
            text: "Partially correct · 0.5 points",
            color: "text-amber-700 dark:text-amber-400",
          }
        : optionIsWrongSelection
          ? {
              text: "Your answer",
              color: "text-red-700 dark:text-red-400",
            }
          : null;

    return (
      <div key={option.id} className="space-y-0.5">
        <div
          className={cn(
            "flex flex-wrap items-start gap-x-2 gap-y-1 rounded py-1 pl-0 pr-1 sm:pl-6 sm:pr-3",
            bgClass,
          )}
        >
          <label className="flex min-w-0 flex-[1_1_12rem] cursor-default items-start gap-2">
            <input
              type="radio"
              name={question.id}
              checked={optionIsSelected}
              readOnly
              disabled
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span className="flex min-w-0 flex-1">
              <span className="inline-block w-6 shrink-0 sm:w-8">
                {letter}.
              </span>
              <span className="ml-0 min-w-0 flex-1 sm:ml-4">
                <OptionText option={option} textTone={contentTextTone} />
              </span>
            </span>
          </label>
          <div className="ml-auto flex w-24 shrink-0 flex-col items-center gap-0.5">
            {label ? (
              <span
                className={cn(
                  "text-center font-medium leading-tight",
                  label.color,
                  theme.labelSize,
                )}
              >
                {label.text}
              </span>
            ) : null}
            <StudentStatsBar
              pct={pct}
              barWidth={barWidth}
              hasStats={hasStats}
              variant={variant}
            />
          </div>
        </div>
        {showExplanations && hasAnswerExplanation(option) ? (
          <AnswerExplanation
            text={option.answerExplanation}
            json={option.answerExplanationJson}
            className="pl-14"
            textTone={contentTextTone}
          />
        ) : null}
      </div>
    );
  };

  const optionsContent = (
    <div className="space-y-3">
      <div className={theme.questionPrompt}>
        <RichContentBlock
          json={question.questionJson}
          plainText={question.questionText}
          preloadedContent={preloadedContent?.question}
          textTone={contentTextTone}
        />
      </div>
      <div className="space-y-2">
        {question.options.map((opt, i) => renderOption(opt, i))}
      </div>
      {showQuestionFooter ? (
        <div className={cn(theme.footer, "mt-3 pt-3")}>
          {typeof points === "number" ? (
            <QuestionPointsFooter points={points} question={question} />
          ) : null}
          {showExplanations && hasAnswerExplanation(question) ? (
            <AnswerExplanation
              text={question.answerExplanation}
              json={question.answerExplanationJson}
              textTone={contentTextTone}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (isTwoColumn) {
    return (
      <div className={theme.twoColumnRoot}>
        <article
          className={theme.stemColumn}
          style={
            theme.site
              ? undefined
              : { borderRightColor: UCAT_COLORS.primaryBlue }
          }
        >
          <div className="space-y-3">
            <RichContentBlock
              json={question.stemJson}
              plainText={question.stemText}
              preloadedContent={preloadedContent?.stem}
              textTone={contentTextTone}
              paragraphSpacing
            />
          </div>
        </article>
        <section className={theme.questionColumn}>{optionsContent}</section>
      </div>
    );
  }

  return (
    <div className={cn(theme.body, theme.scrollRoot)}>
      <div
        className={cn(
          "space-y-4",
          theme.site ? "pt-4 sm:pt-5" : "py-4 sm:py-5",
        )}
      >
        <article className="space-y-3">
          <RichContentBlock
            json={question.stemJson}
            plainText={question.stemText}
            preloadedContent={preloadedContent?.stem}
            textTone={contentTextTone}
            paragraphSpacing
          />
        </article>
        <section className="space-y-3">{optionsContent}</section>
      </div>
    </div>
  );
}
