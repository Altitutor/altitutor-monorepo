"use client";

import { Flag } from "lucide-react";
import {
  UCAT_COLORS,
  UCAT_FONTS,
} from "@altitutor/ui/components/ucat/ucat-theme";
import type { QuestionItem } from "@/features/question-engine/model/types";
import type { ReviewQuestionStatus } from "@/features/question-engine/lib/review";

export type ReviewListRow = {
  question: QuestionItem;
  index: number;
  /** 1-based display number (e.g. "Question 1"). When set, used instead of index + 1 for mock per-set review. */
  displayNumber?: number;
  status: ReviewQuestionStatus;
  flagged: boolean;
};

export function ReviewBody({
  sectionTitle,
  incompleteCount,
  rows,
  flaggedIds,
  onToggleFlag,
  onSelectQuestion,
}: {
  sectionTitle: string;
  incompleteCount: number;
  rows: ReviewListRow[];
  flaggedIds: string[];
  onToggleFlag: (questionId: string) => void;
  onSelectQuestion: (globalIndex: number) => void;
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="shrink-0 p-4"
        style={{ fontFamily: UCAT_FONTS.message, fontSize: "12pt" }}
      >
        <p className="font-normal">
          Review: use this screen to <strong>review</strong> the items and amend
          your responses.
        </p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto border-t border-[#9ba9bd]">
        <div
          className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 text-white"
          style={{ backgroundColor: UCAT_COLORS.toolbarBlue }}
        >
          <h3
            className="text-[12pt] font-normal"
            style={{ fontFamily: UCAT_FONTS.message }}
          >
            {sectionTitle}
          </h3>
          <span
            className="text-[12pt] font-normal"
            style={{ fontFamily: UCAT_FONTS.message }}
          >
            ({incompleteCount} Unseen/Incomplete)
          </span>
        </div>
        <ul className="divide-y divide-[#9ba9bd] bg-white">
          {rows.map((row) => {
            const statusLabel =
              row.status === "complete"
                ? ""
                : row.status === "incomplete"
                  ? "Incomplete"
                  : "Unseen";
            const isFlagged = flaggedIds.includes(row.question.id);
            return (
              <li
                key={row.question.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-[#fffd6f]/30"
                style={{ fontFamily: UCAT_FONTS.message, fontSize: "11pt" }}
              >
                <button
                  type="button"
                  onClick={() => onToggleFlag(row.question.id)}
                  className="flex items-center justify-center p-1 rounded hover:bg-black/10"
                  aria-label={
                    isFlagged ? "Flagged for review" : "Flag for review"
                  }
                  title={
                    isFlagged
                      ? "Flagged for review (click to clear)"
                      : "Flag for review"
                  }
                >
                  {isFlagged ? (
                    <span
                      className="inline-flex rounded p-0.5"
                      style={{
                        backgroundColor: UCAT_COLORS.highlightYellow,
                        color: UCAT_COLORS.primaryBlueDark,
                      }}
                    >
                      <Flag className="h-4 w-4" aria-hidden />
                    </span>
                  ) : (
                    <Flag className="h-4 w-4 text-gray-400" aria-hidden />
                  )}
                </button>
                <button
                  type="button"
                  onDoubleClick={() => onSelectQuestion(row.index)}
                  className="flex-1 text-left py-1 hover:underline"
                  title="Double-click to go to this question"
                >
                  <span>Question {row.displayNumber ?? row.index + 1}</span>
                </button>
                {statusLabel ? (
                  <span
                    className="shrink-0 text-red-600"
                    style={{ color: UCAT_COLORS.statusRed }}
                  >
                    {statusLabel}
                  </span>
                ) : (
                  <span className="shrink-0 w-20" />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
