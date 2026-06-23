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
    block.block_type !== "skill_trainer_set"
  );
}

type LearningLessonContentsSidebarProps = {
  blocks: LearningModuleBlockRow[];
  activeIndex: number;
  completionPercent: number;
  isLessonComplete: boolean;
  canAccessBlock: (index: number) => boolean;
  isBlockComplete: (block: LearningModuleBlockRow) => boolean;
  onSelectBlock: (index: number) => void;
  onMarkBlockComplete: (blockId: string) => void;
  onRequestMarkComplete: () => void;
  onRequestMarkIncomplete: () => void;
  isResettingProgress?: boolean;
  prevLesson: LessonNavEntry | null;
  nextLesson: LessonNavEntry | null;
};

export function LearningLessonContentsSidebar({
  blocks,
  activeIndex,
  completionPercent,
  isLessonComplete,
  canAccessBlock,
  isBlockComplete,
  onSelectBlock,
  onMarkBlockComplete,
  onRequestMarkComplete,
  onRequestMarkIncomplete,
  isResettingProgress = false,
  prevLesson,
  nextLesson,
}: LearningLessonContentsSidebarProps) {
  return (
    <aside className="flex w-full flex-col gap-3 lg:sticky lg:top-6 lg:w-72 lg:shrink-0 lg:self-start">
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
          <p className="text-sm text-muted-foreground">{completionPercent}% complete</p>
          {isLessonComplete ? (
            <Button
              type="button"
              variant="outline"
              className={cn("w-full", UCAT_HEADER_BTN_OUTLINE, "active:scale-[0.98]")}
              disabled={isResettingProgress}
              onClick={onRequestMarkIncomplete}
            >
              Mark incomplete
            </Button>
          ) : (
            <Button type="button" className="w-full" onClick={onRequestMarkComplete}>
              Mark lesson complete
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {blocks.map((block, index) => {
            const locked = !canAccessBlock(index);
            const complete = isBlockComplete(block);
            const manualComplete = canManuallyCompleteBlock(block);
            const isActive = index === activeIndex;

            return (
              <div
                key={block.id}
                className={cn(
                  "group flex items-center gap-2 rounded-md px-2 py-1.5",
                  isActive && "bg-muted",
                  locked && "opacity-50",
                )}
              >
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    if (!locked) onSelectBlock(index);
                  }}
                  className={cn(
                    "min-w-0 flex-1 text-left text-sm",
                    locked ? "cursor-not-allowed" : "cursor-pointer",
                  )}
                >
                  <span className="line-clamp-2">{formatBlockLabel(block, index)}</span>
                </button>

                {manualComplete && block.id ? (
                  <button
                    type="button"
                    aria-label={
                      complete ? "Block complete" : `Mark block ${index + 1} complete`
                    }
                    disabled={complete || locked}
                    onClick={() => onMarkBlockComplete(block.id!)}
                    className={cn(
                      "inline-flex size-5 shrink-0 items-center justify-center rounded-full border transition-opacity",
                      complete
                        ? "pointer-events-none border-primary bg-primary text-primary-foreground opacity-100"
                        : "border-muted-foreground/40 text-muted-foreground opacity-0 hover:border-primary hover:text-primary group-hover:opacity-100 focus-visible:opacity-100",
                    )}
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </button>
                ) : complete ? (
                  <span
                    className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground"
                    aria-hidden
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <LearningLessonPager prev={prevLesson} next={nextLesson} />
    </aside>
  );
}
