"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import type { Json } from "@altitutor/shared";
import { AnimatedStepPanel } from "@/features/signup-onboarding/components/animated-step-panel";
import type { UcatBreadcrumbItem } from "@/features/layout/components/ucat-page-header";
import { UcatPageHeader } from "@/features/layout";
import { RichContentBlock } from "@/features/question-engine/components/rich-content-block";
import {
  learningKeys,
  useLearningLesson,
  useLearningModules,
  useMarkBlockComplete,
  useMarkLessonComplete,
  useResetLessonProgress,
  useStartLesson,
  useUpdateBlockProgress,
} from "@/features/learning/hooks/use-learning";
import { LearnQuestionBlock } from "@/features/learning/components/learn-question-block";
import { LearnSkillTrainerBlock } from "@/features/learning/components/learn-skill-trainer-block";
import { LearningLessonContentsSidebar } from "@/features/learning/components/learning-lesson-contents-sidebar";
import {
  LearningMarkLessonCompleteDialog,
  LearningMarkLessonIncompleteDialog,
} from "@/features/learning/components/learning-lesson-progress-dialogs";
import { LearningLessonPageSkeleton } from "@/features/learning/components/learning-lesson-page-skeleton";
import { formatBlockLabel } from "@/features/learning/lib/format-block-label";
import { buildLessonAncestorPath } from "@/features/learning/lib/build-lesson-ancestors";
import { getAdjacentLessons } from "@/features/learning/lib/flatten-lessons-for-nav";
import type { LearningModuleBlockRow } from "@/features/learning/types";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

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
  const reportedRef = useRef(false);
  const onScrolledToBottomRef = useRef(onScrolledToBottom);
  onScrolledToBottomRef.current = onScrolledToBottom;
  const content = (block.content ?? {}) as Record<string, unknown>;
  const body = content.body as Record<string, unknown> | undefined;

  useEffect(() => {
    reportedRef.current = false;
  }, [block.id]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleScroll = () => {
      if (reportedRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight <= clientHeight + 4) {
        reportedRef.current = true;
        onScrolledToBottomRef.current();
        return;
      }
      if (scrollTop + clientHeight >= scrollHeight - 8) {
        reportedRef.current = true;
        onScrolledToBottomRef.current();
      }
    };

    el.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => el.removeEventListener("scroll", handleScroll);
  }, [block.id]);

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
  const reportedRef = useRef(false);
  const onWatchProgressRef = useRef(onWatchProgress);
  onWatchProgressRef.current = onWatchProgress;
  const content = (block.content ?? {}) as { url?: string };
  const embedUrl = content.url ? getVideoEmbedUrl(content.url) : null;

  useEffect(() => {
    reportedRef.current = false;
  }, [block.id]);

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
        onLoad={() => {
          if (reportedRef.current) return;
          reportedRef.current = true;
          onWatchProgressRef.current(50);
        }}
      />
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
  const reportedRef = useRef(false);
  const onViewedRef = useRef(onViewed);
  onViewedRef.current = onViewed;
  const content = (block.content ?? {}) as { url?: string; label?: string };
  const label = content.label ?? "Open file";

  useEffect(() => {
    reportedRef.current = false;
  }, [block.id]);

  const markViewed = useCallback(() => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    onViewedRef.current();
  }, []);

  return (
    <div className="space-y-3">
      {content.url ? (
        <iframe
          src={content.url}
          title={label}
          className="h-[50vh] w-full rounded-lg border"
          onLoad={markViewed}
        />
      ) : null}
      {content.url ? (
        <Button asChild variant="outline" onClick={markViewed}>
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

function LessonBlockContent({
  block,
  onBlockProgress,
  onSkillTrainerComplete,
  onQuestionProgress,
}: {
  block: LearningModuleBlockRow;
  onBlockProgress: (
    blockId: string,
    completed: boolean,
    interactionState?: Json,
  ) => void;
  onSkillTrainerComplete: (blockId: string) => void;
  onQuestionProgress: () => void;
}) {
  return (
    <>
      {block.block_type === "text" && block.id ? (
        <TextBlock
          block={block}
          onScrolledToBottom={() => onBlockProgress(block.id!, true)}
        />
      ) : null}
      {block.block_type === "video" && block.id ? (
        <VideoBlock
          block={block}
          onWatchProgress={(percent) =>
            onBlockProgress(block.id!, percent >= 50, { videoWatchPercent: percent })
          }
        />
      ) : null}
      {block.block_type === "file" && block.id ? (
        <FileBlock
          block={block}
          onViewed={() => onBlockProgress(block.id!, true, { fileViewed: true })}
        />
      ) : null}
      {block.block_type === "question_stem" || block.block_type === "question" ? (
        <LearnQuestionBlock block={block} onProgressChange={onQuestionProgress} />
      ) : null}
      {block.block_type === "skill_trainer_set" && block.id ? (
        <LearnSkillTrainerBlock
          block={block}
          onComplete={() => onSkillTrainerComplete(block.id!)}
        />
      ) : null}
    </>
  );
}

export function LearningLessonPage({ lessonId }: LearningLessonPageProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useLearningLesson(lessonId);
  const { data: allModules } = useLearningModules();
  const startLesson = useStartLesson(lessonId);
  const updateProgress = useUpdateBlockProgress(lessonId);
  const markBlockComplete = useMarkBlockComplete(lessonId);
  const markLessonComplete = useMarkLessonComplete(lessonId);
  const resetLessonProgress = useResetLessonProgress(lessonId);
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState(1);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [incompleteDialogOpen, setIncompleteDialogOpen] = useState(false);
  const blockRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    setActiveIndex(0);
    setSlideDirection(1);
  }, [lessonId]);

  useEffect(() => {
    startLesson.mutate();
  }, [lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  const blocks = useMemo(() => data?.blocks ?? [], [data?.blocks]);
  const lesson = data?.module;
  const displayMode = lesson?.display_mode ?? "stepped";
  const completionPercent = Number(lesson?.completion_percent ?? 0);
  const isLessonComplete =
    lesson?.completed_at != null || completionPercent >= 100;

  const { prev: prevLesson, next: nextLesson } = useMemo(
    () => getAdjacentLessons(lessonId, allModules ?? []),
    [allModules, lessonId],
  );

  const breadcrumbItems = useMemo((): UcatBreadcrumbItem[] => {
    const items: UcatBreadcrumbItem[] = [{ label: "Learn", href: "/learn" }];
    for (const folder of buildLessonAncestorPath(lessonId, allModules ?? [])) {
      if (folder.title) {
        items.push({ label: folder.title });
      }
    }
    if (lesson?.title) {
      items.push({ label: lesson.title });
    }
    return items;
  }, [allModules, lesson?.title, lessonId]);

  const isBlockComplete = useCallback(
    (block: LearningModuleBlockRow) => block.block_completed_at != null,
    [],
  );

  const incompleteBlocks = useMemo(
    () => blocks.filter((block) => !isBlockComplete(block)),
    [blocks, isBlockComplete],
  );

  const incompleteBlockLabels = useMemo(
    () =>
      incompleteBlocks.map((block) => {
        const index = blocks.findIndex((item) => item.id === block.id);
        return {
          id: block.id ?? `block-${index}`,
          label: formatBlockLabel(block, index >= 0 ? index : 0),
        };
      }),
    [blocks, incompleteBlocks],
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

  const handleBlockProgress = useCallback(
    (blockId: string, completed: boolean, interactionState?: Json) => {
      if (completed) {
        const block = blocks.find((item) => item.id === blockId);
        if (block?.block_completed_at) return;
      }
      updateProgress.mutate({
        blockId,
        payload: {
          interactionState,
          completed,
        },
      });
    },
    [blocks, updateProgress],
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

  const goToBlock = useCallback(
    (index: number) => {
      setSlideDirection(index > activeIndex ? 1 : -1);
      setActiveIndex(index);

      if (displayMode === "scroll") {
        const block = blocks[index];
        if (!block?.id) return;
        const element = blockRefs.current.get(block.id);
        element?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [activeIndex, blocks, displayMode],
  );

  const handleMarkBlockComplete = useCallback(
    (blockId: string) => {
      markBlockComplete.mutate(blockId, {
        onSuccess: refreshLessonProgress,
      });
    },
    [markBlockComplete, refreshLessonProgress],
  );

  const setBlockRef = useCallback((blockId: string, element: HTMLDivElement | null) => {
    if (element) {
      blockRefs.current.set(blockId, element);
      return;
    }
    blockRefs.current.delete(blockId);
  }, []);

  const handleConfirmMarkComplete = useCallback(() => {
    markLessonComplete.mutate(undefined, {
      onSuccess: () => {
        setCompleteDialogOpen(false);
        setActiveIndex(0);
        setSlideDirection(1);
      },
    });
  }, [markLessonComplete]);

  const handleConfirmMarkIncomplete = useCallback(() => {
    resetLessonProgress.mutate(undefined, {
      onSuccess: () => {
        setIncompleteDialogOpen(false);
        setActiveIndex(0);
        setSlideDirection(1);
      },
    });
  }, [resetLessonProgress]);

  if (isLoading) {
    return <LearningLessonPageSkeleton />;
  }
  if (error || !lesson) {
    return <p className="text-sm text-destructive">Lesson not found.</p>;
  }

  const activeBlock = blocks[activeIndex];

  return (
    <motion.div
      className="mx-auto w-full max-w-7xl"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <div className="flex flex-col gap-6 lg:flex-row">
        <motion.div className="min-w-0 flex-1 space-y-6" variants={itemVariants}>
          <UcatPageHeader
            title={lesson.title ?? "Lesson"}
            description={lesson.description ?? undefined}
            backHref="/learn"
            backLabel="All modules"
            breadcrumbItems={breadcrumbItems}
          />

          {displayMode === "stepped" ? (
            <div className="min-h-[200px]">
              {activeBlock ? (
                <AnimatedStepPanel stepKey={activeIndex} direction={slideDirection}>
                  <LessonBlockContent
                    block={activeBlock}
                    onBlockProgress={handleBlockProgress}
                    onSkillTrainerComplete={handleSkillTrainerComplete}
                    onQuestionProgress={refreshLessonProgress}
                  />
                </AnimatedStepPanel>
              ) : null}
            </div>
          ) : (
            <div className="space-y-10">
              {blocks.map((block) =>
                block.id ? (
                  <div
                    key={block.id}
                    ref={(element) => setBlockRef(block.id!, element)}
                    className="scroll-mt-24"
                  >
                    <LessonBlockContent
                      block={block}
                      onBlockProgress={handleBlockProgress}
                      onSkillTrainerComplete={handleSkillTrainerComplete}
                      onQuestionProgress={refreshLessonProgress}
                    />
                  </div>
                ) : null,
              )}
            </div>
          )}
        </motion.div>

        <motion.div variants={itemVariants}>
          <LearningLessonContentsSidebar
            blocks={blocks}
            activeIndex={activeIndex}
            completionPercent={completionPercent}
            isLessonComplete={isLessonComplete}
            canAccessBlock={canAccessBlock}
            isBlockComplete={isBlockComplete}
            onSelectBlock={goToBlock}
            onMarkBlockComplete={handleMarkBlockComplete}
            onRequestMarkComplete={() => setCompleteDialogOpen(true)}
            onRequestMarkIncomplete={() => setIncompleteDialogOpen(true)}
            isResettingProgress={resetLessonProgress.isPending}
            prevLesson={prevLesson}
            nextLesson={nextLesson}
          />
        </motion.div>
      </div>

      <LearningMarkLessonCompleteDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        incompleteBlockLabels={incompleteBlockLabels}
        confirming={markLessonComplete.isPending}
        onConfirm={handleConfirmMarkComplete}
      />
      <LearningMarkLessonIncompleteDialog
        open={incompleteDialogOpen}
        onOpenChange={setIncompleteDialogOpen}
        confirming={resetLessonProgress.isPending}
        onConfirm={handleConfirmMarkIncomplete}
      />
    </motion.div>
  );
}
