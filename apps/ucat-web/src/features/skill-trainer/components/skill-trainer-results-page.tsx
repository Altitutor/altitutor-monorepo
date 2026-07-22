"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, RotateCcw, Trophy, XCircle } from "lucide-react";
import {
  extractSkillTrainerPlainText,
  trainerKeyToSlug,
  type UcatSkillTrainerKey,
} from "@altitutor/shared";
import { Card, CardContent, CardHeader, Skeleton } from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import { UcatPageHeader } from "@/features/layout";
import { RichContentBlock } from "@/features/question-engine/components/rich-content-block";
import {
  skillTrainerApi,
  type SkillTrainerAttemptReview,
} from "@/features/skill-trainer/api/skill-trainer-api";
import { SkillTrainerLeaderboard } from "@/features/skill-trainer/components/skill-trainer-leaderboard";
import { cn } from "@/lib/utils";
import { UCAT_PRIMARY_ACTION_BUTTON } from "@/lib/ucat-surface-motion";

function asRichDoc(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const doc = value as Record<string, unknown>;
  const content = doc.content;
  if (!Array.isArray(content) || content.length === 0) return null;
  return doc;
}

function formatSeconds(seconds: number | null): string {
  if (seconds == null) return "Time unavailable";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(" ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    return value.includes("_") ? "Not recorded" : value;
  }
  return "Not recorded for this run";
}

function getReviewCopy(
  trainerKey: UcatSkillTrainerKey,
  item: SkillTrainerAttemptReview["items"][number],
): {
  prompt: string;
  promptJson?: Record<string, unknown> | null;
  answer: string;
  solution: string;
} {
  const content = item.content;
  switch (trainerKey) {
    case "quick_syllogism": {
      const premises = Array.isArray(content.premises)
        ? content.premises.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      const conclusion =
        (typeof content.conclusion === "string" && content.conclusion) ||
        (typeof content.statement === "string" && content.statement) ||
        "Syllogism";
      return {
        prompt: [...premises, conclusion].join("\n"),
        answer: formatValue(item.answer),
        solution: content.answer === true ? "Yes" : "No",
      };
    }
    case "mental_maths":
      return {
        prompt:
          typeof content.expression === "string"
            ? content.expression
            : "Mental maths question",
        answer: formatValue(item.answer),
        solution: formatValue(content.answer),
      };
    case "calculator_maths": {
      const questionDoc = asRichDoc(content.question);
      const richQuestion = questionDoc
        ? extractSkillTrainerPlainText(questionDoc, { blockSeparator: "\n" })
        : "";
      return {
        prompt:
          richQuestion ||
          (typeof content.expression === "string"
            ? content.expression
            : "Calculator question"),
        promptJson: questionDoc,
        answer: formatValue(item.answer),
        solution: formatValue(content.answer),
      };
    }
    case "numpad_speed": {
      const target = Array.isArray(content.button_sequence)
        ? content.button_sequence.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      return {
        prompt:
          typeof content.label === "string"
            ? content.label
            : "Reproduce the target key sequence",
        answer: formatValue(item.answer),
        solution: target.join(" "),
      };
    }
    case "find_word": {
      const passageDoc = asRichDoc(content.passage);
      const passage = passageDoc
        ? extractSkillTrainerPlainText(passageDoc, { blockSeparator: "\n" })
        : "Find the words in the passage";
      const keywords = Array.isArray(content.keywords)
        ? content.keywords
            .map((keyword) =>
              keyword && typeof keyword === "object" && "text" in keyword
                ? String(keyword.text)
                : "",
            )
            .filter(Boolean)
        : [];
      return {
        prompt: passage,
        promptJson: passageDoc,
        answer: item.correct ? "All keywords placed" : formatValue(item.answer),
        solution: keywords.join(", "),
      };
    }
    case "find_concept": {
      const count = Array.isArray(content.occurrences)
        ? content.occurrences.length
        : 0;
      return {
        prompt: `Find every occurrence of “${String(content.concept ?? "the concept")}”.`,
        answer: item.correct
          ? `Found all ${count}`
          : "Skipped before finding all occurrences",
        solution: `${count} occurrence${count === 1 ? "" : "s"}`,
      };
    }
  }
}

function NumpadComparison({
  answer,
  solution,
}: {
  answer: unknown;
  solution: unknown;
}) {
  const answerKeys = Array.isArray(answer)
    ? answer.filter((value): value is string => typeof value === "string")
    : [];
  const solutionKeys = Array.isArray(solution)
    ? solution.filter((value): value is string => typeof value === "string")
    : [];
  const columnCount = Math.max(answerKeys.length, solutionKeys.length);

  if (answerKeys.length === 0) {
    return (
      <p className="font-mono text-sm text-muted-foreground">
        This answer was not recorded for this run.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-muted/40 p-4 font-mono text-sm sm:p-5 sm:text-base">
      <div className="grid min-w-max grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
        <span className="font-semibold text-muted-foreground">
          Your answer:
        </span>
        <span className="flex gap-2">
          {Array.from({ length: columnCount }, (_, index) => {
            const key = answerKeys[index];
            const matches = key != null && key === solutionKeys[index];
            return (
              <span
                key={`answer-${index}`}
                className={cn(
                  "inline-flex min-w-5 justify-center font-semibold",
                  key != null && !matches && "text-destructive",
                )}
              >
                {key ?? "·"}
              </span>
            );
          })}
        </span>
        <span className="font-semibold text-muted-foreground">Solution:</span>
        <span className="flex gap-2">
          {Array.from({ length: columnCount }, (_, index) => (
            <span
              key={`solution-${index}`}
              className="inline-flex min-w-5 justify-center font-semibold"
            >
              {solutionKeys[index] ?? "·"}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

function QuestionReviewCard({
  trainerKey,
  item,
  index,
}: {
  trainerKey: UcatSkillTrainerKey;
  item: SkillTrainerAttemptReview["items"][number];
  index: number;
}) {
  const copy = getReviewCopy(trainerKey, item);
  const StatusIcon = item.correct ? CheckCircle2 : XCircle;

  return (
    <Card
      className={cn(
        item.correct ? "border-emerald-500/30" : "border-destructive/30",
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <StatusIcon
            className={cn(
              "h-5 w-5",
              item.correct ? "text-emerald-600" : "text-destructive",
            )}
            aria-hidden
          />
          <h3 className="font-semibold">Question {index + 1}</h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground sm:text-sm">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" aria-hidden />
            {formatSeconds(item.elapsed_seconds)}
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <Trophy className="h-3.5 w-3.5" aria-hidden />
            {item.score_delta > 0 ? "+" : ""}
            {item.score_delta}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {trainerKey === "numpad_speed" ? (
          <NumpadComparison
            answer={item.answer}
            solution={item.content.button_sequence}
          />
        ) : (
          <>
            {copy.promptJson ? (
              <div className="text-sm leading-6 sm:text-base">
                <RichContentBlock
                  json={copy.promptJson}
                  plainText={copy.prompt}
                  textTone="theme"
                />
              </div>
            ) : (
              <p className="whitespace-pre-line text-sm leading-6 sm:text-base">
                {copy.prompt}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Your answer
                </p>
                <p className="mt-1 text-sm font-medium">{copy.answer}</p>
              </div>
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Solution
                </p>
                <p className="mt-1 text-sm font-medium">{copy.solution}</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function SkillTrainerResultsPage({
  trainerKey,
  attemptId,
}: {
  trainerKey: UcatSkillTrainerKey;
  attemptId: string;
}) {
  const queryClient = useQueryClient();
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const slug = trainerKeyToSlug(trainerKey);
  const { data, isLoading, error } = useQuery({
    queryKey: ["skill-trainers", "attempt-review", attemptId],
    queryFn: () => skillTrainerApi.getAttemptReview(attemptId),
    staleTime: 0,
  });

  useEffect(() => {
    void queryClient.invalidateQueries({
      queryKey: ["skill-trainers", "leaderboard", trainerKey],
    });
  }, [queryClient, trainerKey]);

  if (isLoading) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Loading results">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data || data.attempt.trainer_key !== trainerKey) {
    return (
      <div className="space-y-4">
        <UcatPageHeader
          title="Results unavailable"
          description={
            error instanceof Error
              ? error.message
              : "This attempt could not be loaded."
          }
        />
        <Button asChild variant="outline">
          <Link href={`/skill-trainer/${slug}`}>Back to trainer</Link>
        </Button>
      </div>
    );
  }

  const correctCount = data.items.filter((item) => item.correct).length;
  const selectedItem =
    data.items[Math.min(selectedItemIndex, Math.max(0, data.items.length - 1))];

  return (
    <div className="space-y-8 pb-10">
      <UcatPageHeader
        title="Skill trainer complete"
        description="Review every item from this run, then have another go when you’re ready."
      />

      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Final score
            </p>
            <p className="mt-1 text-5xl font-bold tabular-nums">
              {data.attempt.score}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl border bg-background/80 px-4 py-3">
              <p className="text-xs text-muted-foreground">Correct</p>
              <p className="mt-1 font-semibold tabular-nums">
                {correctCount} / {data.items.length}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                <Link href={`/skill-trainer/${slug}`}>Back to trainer</Link>
              </Button>
              <Button
                className={cn("gap-2", UCAT_PRIMARY_ACTION_BUTTON)}
                asChild
              >
                <Link href={`/skill-trainer/${slug}/play`}>
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Play again
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {trainerKey !== "find_word" ? (
        <section className="space-y-4" aria-labelledby="review-heading">
          <h2
            id="review-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Questions
          </h2>

          {data.items.length === 0 || !selectedItem ? (
            <p className="text-sm text-muted-foreground">
              No items were completed before time ran out.
            </p>
          ) : (
            <div className="space-y-4">
              <nav
                className="flex gap-2 overflow-x-auto pb-1"
                aria-label="Completed questions"
              >
                {data.items.map((item, index) => {
                  const StatusIcon = item.correct ? CheckCircle2 : XCircle;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selectedItemIndex === index}
                      onClick={() => setSelectedItemIndex(index)}
                      className={cn(
                        "flex min-w-[7.5rem] items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left text-sm transition-colors",
                        selectedItemIndex === index
                          ? "border-primary ring-2 ring-primary/20"
                          : "hover:border-primary/50",
                      )}
                    >
                      <StatusIcon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          item.correct
                            ? "text-emerald-600"
                            : "text-destructive",
                        )}
                        aria-hidden
                      />
                      Question {index + 1}
                    </button>
                  );
                })}
              </nav>

              <QuestionReviewCard
                trainerKey={trainerKey}
                item={selectedItem}
                index={data.items.indexOf(selectedItem)}
              />
            </div>
          )}
        </section>
      ) : null}

      <SkillTrainerLeaderboard trainerKey={trainerKey} />
    </div>
  );
}
