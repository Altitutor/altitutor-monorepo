"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import type { Json } from "@altitutor/shared";
import { UcatPageHeader } from "@/features/layout";
import { RichContentBlock } from "@/features/question-engine/components/rich-content-block";
import {
  learningKeys,
  useLearningLesson,
  useMarkBlockComplete,
  useMarkLessonComplete,
  useStartLesson,
  useUpdateBlockProgress,
} from "@/features/learning/hooks/use-learning";
import { LearnQuestionBlock } from "@/features/learning/components/learn-question-block";
import { LearnSkillTrainerBlock } from "@/features/learning/components/learn-skill-trainer-block";
import type { LearningModuleBlockRow } from "@/features/learning/types";
import { cn } from "@/lib/utils";

type LearningLessonPageProps = {
  lessonId: string;
};

function getVideoEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com") || parsed.hostname.includes("youtu.be")) {
      const videoId = parsed.hostname.includes("youtu.be")
        ? parsed.pathname.slice(1)
        : parsed.searchParams.get("v");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    return url;
  } catch {
    return null;
  }
}

function TextBlock({
  block,
  onScrolledToBottom,
}: {
  block: LearningModuleBlockRow;
  onScrolledToBottom: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const content = (block.content ?? {}) as Record<string, unknown>;
  const body = content.body as Record<string, unknown> | undefined;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight <= clientHeight + 4) {
        onScrolledToBottom();
        return;
      }
      if (scrollTop + clientHeight >= scrollHeight - 8) {
        onScrolledToBottom();
      }
    };

    el.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => el.removeEventListener("scroll", handleScroll);
  }, [onScrolledToBottom]);

  return (
    <div ref={ref} className="max-h-[60vh] overflow-auto pr-2">
      <RichContentBlock json={body ?? null} plainText="" />
    </div>
  );
}

function VideoBlock({
  block,
  onWatchProgress,
}: {
  block: LearningModuleBlockRow;
  onWatchProgress: (percent: number) => void;
}) {
  const content = (block.content ?? {}) as { url?: string };
  const embedUrl = content.url ? getVideoEmbedUrl(content.url) : null;

  if (!embedUrl) {
    return <p className="text-sm text-muted-foreground">Video URL not configured.</p>;
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg border">
      <iframe
        src={embedUrl}
        title="Lesson video"
        className="size-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        onLoad={() => onWatchProgress(50)}
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Video progress is tracked when the player loads. Use Mark block complete if needed.
      </p>
    </div>
  );
}

function FileBlock({
  block,
  onViewed,
}: {
  block: LearningModuleBlockRow;
  onViewed: () => void;
}) {
  const content = (block.content ?? {}) as { url?: string; label?: string };
  const label = content.label ?? "Open file";

  return (
    <div className="space-y-3">
      {content.url ? (
        <iframe
          src={content.url}
          title={label}
          className="h-[50vh] w-full rounded-lg border"
          onLoad={onViewed}
        />
      ) : null}
      {content.url ? (
        <Button asChild variant="outline" onClick={onViewed}>
          <a href={content.url} target="_blank" rel="noreferrer">
            {label}
          </a>
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">File not configured.</p>
      )}
    </div>
  );
}

export function LearningLessonPage({ lessonId }: LearningLessonPageProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useLearningLesson(lessonId);
  const startLesson = useStartLesson(lessonId);
  const updateProgress = useUpdateBlockProgress(lessonId);
  const markBlockComplete = useMarkBlockComplete(lessonId);
  const markLessonComplete = useMarkLessonComplete(lessonId);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    startLesson.mutate();
  }, [lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  const blocks = useMemo(() => data?.blocks ?? [], [data?.blocks]);
  const lesson = data?.module;
  const displayMode = lesson?.display_mode ?? "stepped";
  const completionPercent = Number(lesson?.completion_percent ?? 0);

  const isBlockComplete = useCallback(
    (block: LearningModuleBlockRow) => block.block_completed_at != null,
    [],
  );

  const canAccessBlock = useCallback(
    (index: number) => {
      if (index === 0) return true;
      for (let i = 0; i < index; i += 1) {
        const prior = blocks[i];
        if (!prior) return false;
        if (prior.require_completion_before_next && !isBlockComplete(prior)) {
          return false;
        }
      }
      return true;
    },
    [blocks, isBlockComplete],
  );

  const visibleBlocks = useMemo(() => {
    if (displayMode === "scroll") return blocks;
    return blocks[activeIndex] ? [blocks[activeIndex]] : [];
  }, [blocks, displayMode, activeIndex]);

  const handleBlockProgress = useCallback(
    (blockId: string, completed: boolean, interactionState?: Json) => {
      updateProgress.mutate({
        blockId,
        payload: {
          interactionState,
          completed,
        },
      });
    },
    [updateProgress],
  );

  const refreshLessonProgress = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: learningKeys.lesson(lessonId) });
    void queryClient.invalidateQueries({ queryKey: learningKeys.modules() });
  }, [queryClient, lessonId]);

  const handleSkillTrainerComplete = useCallback(
    (blockId: string) => {
      markBlockComplete.mutate(blockId, {
        onSuccess: refreshLessonProgress,
      });
    },
    [markBlockComplete, refreshLessonProgress],
  );

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading lesson...</p>;
  }
  if (error || !lesson) {
    return <p className="text-sm text-destructive">Lesson not found.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <UcatPageHeader
          title={lesson.title ?? "Lesson"}
          description={lesson.description ?? undefined}
          backHref="/learn"
          backLabel="All modules"
        />

        {visibleBlocks.map((block) => (
          <Card key={block.id}>
            <CardHeader>
              <CardTitle className="text-base capitalize">
                {block.block_type?.replace(/_/g, " ")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {block.block_type === "text" && block.id ? (
                <TextBlock
                  block={block}
                  onScrolledToBottom={() => handleBlockProgress(block.id!, true)}
                />
              ) : null}
              {block.block_type === "video" && block.id ? (
                <VideoBlock
                  block={block}
                  onWatchProgress={(percent) =>
                    handleBlockProgress(block.id!, percent >= 50, { videoWatchPercent: percent })
                  }
                />
              ) : null}
              {block.block_type === "file" && block.id ? (
                <FileBlock
                  block={block}
                  onViewed={() => handleBlockProgress(block.id!, true, { fileViewed: true })}
                />
              ) : null}
              {block.block_type === "question_stem" || block.block_type === "question" ? (
                <LearnQuestionBlock block={block} onProgressChange={refreshLessonProgress} />
              ) : null}
              {block.block_type === "skill_trainer_set" && block.id ? (
                <LearnSkillTrainerBlock
                  block={block}
                  onComplete={() => handleSkillTrainerComplete(block.id!)}
                />
              ) : null}

              {block.id &&
              block.block_type !== "question_stem" &&
              block.block_type !== "question" &&
              block.block_type !== "skill_trainer_set" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markBlockComplete.mutate(block.id!)}
                >
                  Mark block complete
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}

        {displayMode === "stepped" ? (
          <div className="flex justify-between">
            <Button
              variant="outline"
              disabled={activeIndex === 0}
              onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
            >
              Previous
            </Button>
            <Button
              disabled={
                activeIndex >= blocks.length - 1 ||
                !canAccessBlock(activeIndex + 1)
              }
              onClick={() => setActiveIndex((i) => Math.min(blocks.length - 1, i + 1))}
            >
              Next
            </Button>
          </div>
        ) : null}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
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
            <Button className="w-full" onClick={() => markLessonComplete.mutate()}>
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
              return (
                <button
                  key={block.id}
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    if (!locked) setActiveIndex(index);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm",
                    index === activeIndex && "bg-muted",
                    locked && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span>
                    {index + 1}. {block.block_type?.replace(/_/g, " ")}
                  </span>
                  {isBlockComplete(block) ? (
                    <span className="text-xs text-muted-foreground">Done</span>
                  ) : null}
                </button>
              );
            })}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
