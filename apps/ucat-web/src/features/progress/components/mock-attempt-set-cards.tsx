"use client";

import { UcatHoverChevron } from "@/lib/ucat-hover-chevron";
import { UCAT_CARD_RAISED_HOVER } from "@/lib/ucat-surface-motion";
import type {
  MockAttemptDetailResponse,
  MockSetInfo,
} from "@/app/api/ucat/progress/mock-attempts/[id]/route";
import { computeCategoryBreakdown } from "../lib/compute-category-breakdown";
import { AttemptReviewScoreCard } from "./attempt-review-score-card";

type MockAttemptSetCardsProps = {
  sets: MockSetInfo[];
  questionAttempts: MockAttemptDetailResponse["questionAttempts"];
  onSelectSet?: (setIndex: number) => void;
};

export function MockAttemptSetCards({
  sets,
  questionAttempts,
  onSelectSet,
}: MockAttemptSetCardsProps) {
  if (sets.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {sets.map((set, setIndex) => {
        const points = set.scorePoints ?? 0;
        const total = set.totalPoints ?? 0;
        const setAttempts = questionAttempts.filter(
          (q) => q.setIndex === setIndex,
        );
        const categoryBreakdown = computeCategoryBreakdown(setAttempts);
        const isSelectable =
          onSelectSet != null &&
          questionAttempts.some((q) => q.setIndex === setIndex);

        const card = (
          <AttemptReviewScoreCard
            title={set.questionSetName ?? "Set"}
            points={points}
            total={total}
            scaledScore={set.scaledScore}
            categoryBreakdown={categoryBreakdown}
            className={isSelectable ? UCAT_CARD_RAISED_HOVER : undefined}
            headerClassName={
              isSelectable ? "relative space-y-0 pr-12" : undefined
            }
            headerAccessory={
              isSelectable ? (
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center sm:right-3">
                  <UcatHoverChevron className="h-4 w-4" />
                </div>
              ) : null
            }
          />
        );

        if (!isSelectable) {
          return <div key={set.questionSetId}>{card}</div>;
        }

        return (
          <button
            key={set.questionSetId}
            type="button"
            className="group block w-full cursor-pointer text-left"
            aria-label={`Jump to ${set.questionSetName ?? "set"} questions`}
            onClick={() => onSelectSet(setIndex)}
          >
            {card}
          </button>
        );
      })}
    </div>
  );
}
