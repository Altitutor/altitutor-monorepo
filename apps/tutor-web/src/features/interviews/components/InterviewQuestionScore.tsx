"use client";

import { Input } from "@altitutor/ui";
import type { InterviewFeedback } from "@altitutor/shared";

/** Preserve written feedback when scoring, and scores when editing feedback. */
export function updateQuestionFeedback(
  feedback: InterviewFeedback[],
  placementId: string,
  change: Partial<Pick<InterviewFeedback, "value" | "score">>,
): InterviewFeedback[] {
  const previous = feedback.find((entry) => entry.placementId === placementId);
  const next = { placementId, value: null, ...previous, ...change };
  return [
    ...feedback.filter((entry) => entry.placementId !== placementId),
    next,
  ];
}

export function InterviewQuestionScore({
  id,
  score,
  maximumPoints,
  disabled,
  onChange,
}: {
  id: string;
  score: number | null | undefined;
  maximumPoints: number;
  disabled: boolean;
  onChange: (score: number | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        Question score (optional)
      </label>
      <Input
        id={id}
        className="w-24"
        type="number"
        min={0}
        max={maximumPoints}
        step="any"
        value={score ?? ""}
        disabled={disabled}
        onChange={(event) =>
          onChange(
            event.target.value === "" ? null : Number(event.target.value),
          )
        }
      />
      <span className="text-sm">/ {maximumPoints}</span>
    </div>
  );
}

export function SuggestedStationScore({
  feedback,
  maximumPoints,
}: {
  feedback: InterviewFeedback[];
  maximumPoints: number;
}) {
  const scores = feedback.flatMap((entry) =>
    typeof entry.score === "number" && Number.isFinite(entry.score)
      ? [entry.score]
      : [],
  );
  if (!scores.length) return null;
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return (
    <p className="text-sm text-muted-foreground" role="status">
      Suggested station score:{" "}
      <strong className="text-foreground">
        {Number(average.toFixed(2))} / {maximumPoints}
      </strong>
      <span className="ml-2">
        Average of {scores.length} scored question
        {scores.length === 1 ? "" : "s"}. Enter the station score separately.
      </span>
    </p>
  );
}
