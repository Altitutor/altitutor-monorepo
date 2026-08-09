"use client";

import { useEffect, useState } from "react";
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
import type { ReviewContract } from "@altitutor/ucat-response-contract";
import {
  evaluatePersistedQuestionResponse,
  getQuestionMaximumMarks,
  isBinaryPlacementResponse,
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

const syllogismAnswerWrongClass = (site: boolean) =>
  site
    ? "border-red-700 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
    : "border-red-700 bg-red-50 text-red-800";

const syllogismAnswerCorrectClass = (site: boolean) =>
  site
    ? "border-green-700 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300"
    : "border-green-700 bg-green-50 text-green-800";

export function ResultsQuestionViewer({
  question,
  selectedOptionId,
  correctOptionId,
  points,
  syllogismSnapshot,
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
  syllogismSnapshot?: Record<string, boolean>;
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
      snapshotQuestionResponse(question, selectedOptionId, syllogismSnapshot),
    ).review;

  useEffect(() => {
    // Trigger bar animation when question changes
    setAnimateBars(false);
    const id = window.setTimeout(() => setAnimateBars(true), 0);
    return () => window.clearTimeout(id);
  }, [question.id]);

  if (isBinaryPlacementResponse(question)) {
    const options = [...question.options].sort((a, b) => a.index - b.index);

    const rows = options.map((opt) => {
      const projectedRow =
        projectedReview.kind === "placement"
          ? projectedReview.rows.find((row) => row.targetId === opt.id)
          : undefined;
      const studentHasAnswer = projectedRow?.placedToken != null;
      const studentYes = projectedRow?.placedToken === "yes";
      const correctYes = projectedRow?.correctToken === "yes";
      const isCorrect = projectedRow?.outcome === "correct";

      const hasStats =
        opt.totalAnswered != null &&
        opt.totalAnswered >= MIN_ANSWER_DISTRIBUTION_SAMPLE_SIZE;
      const pct = hasStats ? Math.max(0, opt.percentage ?? 0) : 0;
      const barWidth = animateBars ? Math.min(100, pct) : 0;

      return {
        option: opt,
        studentYes,
        studentHasAnswer,
        correctYes,
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
      syllogismSnapshot == null;
    const isReviewingSyllogism = syllogismSnapshot != null;
    const showStudentsColumn = rows.some((row) => row.hasStats);
    const syllogismGridCols = showStudentsColumn
      ? "grid-cols-[minmax(0,3fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1.2fr)]"
      : "grid-cols-[minmax(0,3fr)_minmax(0,1.4fr)_minmax(0,1.4fr)]";

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
              This attempt was scored, but its individual statement answers were
              not saved. New syllogism attempts retain these answers.
            </p>
          ) : null}
          <div className="mt-3 space-y-1.5">
            <div
              className={cn(
                "grid gap-x-1 gap-y-0.5 pl-4 pr-3",
                syllogismGridCols,
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
                  studentYes,
                  studentHasAnswer,
                  correctYes,
                  isCorrect,
                  hasStats,
                  pct,
                  barWidth,
                }) => {
                  const isStatementCorrect =
                    studentHasAnswer && studentYes === correctYes;
                  const rowHighlight = isReviewingSyllogism
                    ? isStatementCorrect
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
                        syllogismGridCols,
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
                              ? syllogismAnswerCorrectClass(theme.site)
                              : rowHighlight === "wrong"
                                ? syllogismAnswerWrongClass(theme.site)
                                : !studentHasAnswer
                                  ? theme.site
                                    ? "border-dashed border-muted-foreground/50 text-muted-foreground"
                                    : "border-dashed border-[#9ca3af] text-[#9ca3af]"
                                  : isCorrect
                                    ? syllogismAnswerCorrectClass(theme.site)
                                    : syllogismAnswerWrongClass(theme.site),
                          )}
                        >
                          {studentHasAnswer ? (studentYes ? "Yes" : "No") : "—"}
                        </div>
                      </div>
                      <div className="flex items-center justify-center">
                        <div className={theme.correctAnswerBox}>
                          {correctYes ? "Yes" : "No"}
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
