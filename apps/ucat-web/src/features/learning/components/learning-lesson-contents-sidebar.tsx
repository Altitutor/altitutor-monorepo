"use client";

import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import { LearningLessonPager } from "@/features/learning/components/learning-lesson-pager";
import { formatBlockLabel } from "@/features/learning/lib/format-block-label";
import type { LessonNavEntry } from "@/features/learning/lib/flatten-lessons-for-nav";
import type { LearningModuleBlockRow } from "@/features/learning/types";
import { UCAT_HEADER_BTN_OUTLINE } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

function canManuallyCompleteBlock(block: LearningModuleBlockRow): boolean {
  return (
    block.block_type !== "question_stem" &&
    block.block_type !== "question" &&
    block.block_type !== "skill_trainer"
  );
}

type LearningLessonContentsSidebarProps = {
  blocks: LearningModuleBlockRow[];
  activeIndex: number;
  completionPercent: number;
  isLessonComplete: boolean;
  isBlockComplete: (block: LearningModuleBlockRow) => boolean;
  onSelectBlock: (index: number) => void;
  onMarkBlockComplete: (blockId: string) => void;
  onRequestMarkComplete: () => void;
  onRequestMarkIncomplete: () => void;
  isResettingProgress?: boolean;
  nextLesson: LessonNavEntry | null;
};

export function LearningLessonContentsSidebar({
  blocks,
  activeIndex,
  completionPercent,
  isLessonComplete,
  isBlockComplete,
  onSelectBlock,
  onMarkBlockComplete,
  onRequestMarkComplete,
  onRequestMarkIncomplete,
  isResettingProgress = false,
  nextLesson,
}: LearningLessonContentsSidebarProps) {
  return (
    <aside className="flex w-full flex-col gap-3 lg:sticky lg:top-20 lg:w-72 lg:shrink-0 lg:self-start">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {completionPercent}% complete
          </p>
          {isLessonComplete ? (
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-full",
                UCAT_HEADER_BTN_OUTLINE,
                "active:scale-[0.98]",
              )}
              disabled={isResettingProgress}
              onClick={onRequestMarkIncomplete}
            >
              Mark incomplete
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-full",
                UCAT_HEADER_BTN_OUTLINE,
                "active:scale-[0.98]",
              )}
              onClick={onRequestMarkComplete}
            >
              Mark lesson complete
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">On this page</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {blocks.map((block, index) => {
            const complete = isBlockComplete(block);
            const manualComplete = canManuallyCompleteBlock(block);
            const isActive = index === activeIndex;

            return (
              <div
                key={block.id}
                className={cn(
                  "group flex items-center gap-2 rounded-md px-2 py-1.5",
                  isActive && "bg-muted/70",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectBlock(index)}
                  className={cn(
                    "min-w-0 flex-1 text-left text-sm text-muted-foreground transition-colors",
                    isActive && "text-foreground",
                    "cursor-pointer hover:text-foreground",
                  )}
                >
                  <span className="line-clamp-2">
                    {formatBlockLabel(block)}
                  </span>
                </button>

                {manualComplete && block.id ? (
                  <button
                    type="button"
                    aria-label={
                      complete
                        ? "Block complete"
                        : `Mark block ${index + 1} complete`
                    }
                    disabled={complete}
                    onClick={() => onMarkBlockComplete(block.id!)}
                    className={cn(
                      "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-[color,opacity]",
                      complete
                        ? "pointer-events-none opacity-100"
                        : "opacity-0 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100",
                    )}
                  >
                    <Check className="size-3.5" strokeWidth={2} />
                  </button>
                ) : complete ? (
                  <span
                    className="inline-flex size-5 shrink-0 items-center justify-center text-muted-foreground/60"
                    aria-hidden
                  >
                    <Check className="size-3.5" strokeWidth={2} />
                  </span>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div id="tour-learning-navigation">
        <LearningLessonPager next={nextLesson} />
      </div>
    </aside>
  );
}
