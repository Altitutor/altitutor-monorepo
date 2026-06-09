"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import type { Json } from "@altitutor/shared";
import { UcatPageHeader } from "@/features/layout";
import { RichContentBlock } from "@/features/question-engine/components/rich-content-block";
import {
  useLearningLesson,
  useMarkBlockComplete,
  useMarkLessonComplete,
  useStartLesson,
  useUpdateBlockProgress,
} from "@/features/learning/hooks/use-learning";
import type { LearningModuleBlockRow } from "@/features/learning/types";
import { skillTrainerApi } from "@/features/skill-trainer/api/skill-trainer-api";
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

function QuestionBlock({ block }: { block: LearningModuleBlockRow }) {
  if (block.block_type === "question_stem" && block.question_stem_id) {
    return (
      <Button asChild>
        <Link href={`/practice/stem/${block.question_stem_id}`}>Open question stem</Link>
      </Button>
    );
  }
  if (block.block_type === "question" && block.question_id) {
    return (
      <Button asChild>
        <Link href="/practice">Open in practice</Link>
      </Button>
    );
  }
  return null;
}

function SkillTrainerSetBlock({
  block,
  lessonId,
}: {
  block: LearningModuleBlockRow;
  lessonId: string;
}) {
  const [starting, setStarting] = useState(false);
  const trainerKey = (block.content as { trainerKey?: string } | null)?.trainerKey;

  async function handleStart() {
    if (!block.id || !block.skill_trainer_set_id || !trainerKey) return;
    setStarting(true);
    try {
      const state = await skillTrainerApi.startSetAttempt({
        trainerKey,
        skillTrainerSetId: block.skill_trainer_set_id,
        learningModuleBlockId: block.id,
      });
      const { trainerKeyToSlug, isUcatSkillTrainerKey } = await import("@altitutor/shared");
      const playSlug = isUcatSkillTrainerKey(trainerKey)
        ? trainerKeyToSlug(trainerKey)
        : trainerKey.replace(/_/g, "-");
      window.location.href = `/skill-trainer/${playSlug}/play?attemptId=${state.attempt.id}&lessonId=${lessonId}&blockId=${block.id}`;
    } finally {
      setStarting(false);
    }
  }

  return (
    <Button onClick={handleStart} disabled={starting || !trainerKey}>
      {starting ? "Starting..." : "Start skill trainer"}
    </Button>
  );
}

export function LearningLessonPage({ lessonId }: LearningLessonPageProps) {
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
                <QuestionBlock block={block} />
              ) : null}
              {block.block_type === "skill_trainer_set" && block.id ? (
                <SkillTrainerSetBlock block={block} lessonId={lessonId} />
              ) : null}

              {block.id ? (
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
