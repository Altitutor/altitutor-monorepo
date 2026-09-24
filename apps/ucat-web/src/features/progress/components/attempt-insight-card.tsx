"use client";

import React, { type ReactNode } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { BookOpen, Sparkles } from "lucide-react";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { AnswerExplanation } from "@/features/question-engine/components/question-content";
import type { AttemptInsight } from "../lib/attempt-insights";
import type { RemediationLessonLink } from "../lib/remediation-learning-modules";
import type { WrongAnswerInsightItem } from "../lib/question-insight-evidence";
import { WrongAnswerInsightList } from "./wrong-answer-insight-list";
import { ContentRatingControls } from "@/features/content-ratings/components/content-rating-controls";
import { contentSnapshotVersion } from "@/features/content-ratings/lib";

type QuestionExplanation = {
  text?: string;
  json?: Record<string, unknown> | null;
};

type AttemptInsightCardProps = {
  label: "Overall insight" | "Question insight";
  insight: AttemptInsight;
  ratingContextKey: string;
  className?: string;
  children?: ReactNode;
  wrongAnswerItems?: readonly WrongAnswerInsightItem[];
  questionExplanation?: QuestionExplanation | null;
  remediationLessons?: readonly RemediationLessonLink[];
};

export function AttemptInsightCard({
  label,
  insight,
  ratingContextKey,
  className,
  children,
  wrongAnswerItems = [],
  questionExplanation = null,
  remediationLessons = [],
}: AttemptInsightCardProps) {
  const showQuestionExplanation = Boolean(
    questionExplanation?.text || questionExplanation?.json,
  );
  const showWrongAnswers =
    label === "Question insight" && wrongAnswerItems.length > 0;
  const displayedContent = {
    title: insight.title,
    body: [
      showQuestionExplanation
        ? (questionExplanation?.text?.trim() ?? "")
        : "",
      showWrongAnswers
        ? wrongAnswerItems
            .map(
              (item) =>
                item.option.answerExplanation?.trim() || item.option.text,
            )
            .join("\n\n")
        : showQuestionExplanation
          ? ""
          : insight.body,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
  const isQuestionInsight = label === "Question insight";

  return (
    <Card
      className={cn(
        UCAT_CARD_CHROME,
        "overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.06] via-card to-card",
        insight.tone === "positive" && "border-emerald-500/20",
        insight.tone === "coaching" && "border-amber-500/20",
        className,
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Sparkles className="size-3.5" aria-hidden />
          {label}
        </div>
        <CardTitle className="pt-1 text-lg font-semibold tracking-tight">
          {insight.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {showQuestionExplanation && questionExplanation ? (
            <AnswerExplanation
              text={questionExplanation.text}
              json={questionExplanation.json}
              textTone="theme"
            />
          ) : null}
          {showWrongAnswers ? (
            <WrongAnswerInsightList items={wrongAnswerItems} />
          ) : showQuestionExplanation ? null : (
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {insight.body}
            </p>
          )}
        </div>
        {remediationLessons.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Related lessons
            </p>
            <ul className="space-y-1.5">
              {remediationLessons.map((lesson) => (
                <li key={lesson.id}>
                  <Link
                    href={lesson.href}
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    <BookOpen className="size-3.5 shrink-0" aria-hidden />
                    {lesson.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <ContentRatingControls
          className="mt-3"
          descriptor={{
            targetType: isQuestionInsight
              ? "question_insight"
              : "attempt_insight",
            targetKey: insight.ruleId,
            targetVersion: contentSnapshotVersion(displayedContent),
            contextKey: ratingContextKey,
            surface: "attempt",
            displayedContent,
          }}
        />
        {children ? (
          <div className="mt-5 border-t border-border/60 pt-4">{children}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
