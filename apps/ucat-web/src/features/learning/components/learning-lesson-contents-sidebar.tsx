"use client";

import { Check } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { LearningLessonPager } from "@/features/learning/components/learning-lesson-pager";
import type { LessonNavEntry } from "@/features/learning/lib/flatten-lessons-for-nav";
import type { LearningModuleBlockRow } from "@/features/learning/types";
import { cn } from "@/lib/utils";

function formatBlockLabel(block: LearningModuleBlockRow, index: number): string {
  const typeLabel = block.block_type?.replace(/_/g, " ") ?? "Block";
  return `${index + 1}. ${typeLabel}`;
}

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
  canAccessBlock: (index: number) => boolean;
  isBlockComplete: (block: LearningModuleBlockRow) => boolean;
  onSelectBlock: (index: number) => void;
  onMarkBlockComplete: (blockId: string) => void;
  onMarkLessonComplete: () => void;
  prevLesson: LessonNavEntry | null;
  nextLesson: LessonNavEntry | null;
};

export function LearningLessonContentsSidebar({
  blocks,
  activeIndex,
  completionPercent,
  canAccessBlock,
  isBlockComplete,
  onSelectBlock,
  onMarkBlockComplete,
  onMarkLessonComplete,
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
          <Button className="w-full" onClick={onMarkLessonComplete}>
            Mark lesson complete
          </Button>
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
