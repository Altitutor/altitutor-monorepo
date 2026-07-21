"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Json } from "@altitutor/shared";
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
  useUpdateBlockProgress,
} from "@/features/learning/hooks/use-learning";
import { useQuotaLimitDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import { useStudyPlanCompanion } from "@/features/study-plan/context/study-plan-companion-context";
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
import { quotaRouteFallback } from "@/features/ucat-access/lib/quota-route-fallback";
import type { LearningModuleBlockRow } from "@/features/learning/types";
import { QuotaExceededError } from "@/lib/ucat/quota/parse-quota-error";
import { cn } from "@/lib/utils";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

type LearningLessonPageProps = {
  lessonId: string;
};

const LEARNING_TEXT_CONTENT_CLASSNAME = cn(
  "text-foreground",
  "[&_.ProseMirror]:leading-relaxed",
  "[&_.ProseMirror_h1]:mb-4 [&_.ProseMirror_h1]:mt-6 [&_.ProseMirror_h1]:text-3xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:leading-tight",
  "[&_.ProseMirror_h2]:mb-3 [&_.ProseMirror_h2]:mt-5 [&_.ProseMirror_h2]:text-2xl [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:leading-tight",
  "[&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:mt-4 [&_.ProseMirror_h3]:text-xl [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:leading-snug",
  "[&_.ProseMirror_blockquote]:my-4 [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-primary/30 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_blockquote]:text-muted-foreground",
  "[&_.ProseMirror_pre]:my-4 [&_.ProseMirror_pre]:overflow-x-auto [&_.ProseMirror_pre]:rounded-md [&_.ProseMirror_pre]:bg-primary/10 [&_.ProseMirror_pre]:p-3 [&_.ProseMirror_pre]:font-mono [&_.ProseMirror_pre]:text-sm",
  "[&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:bg-primary/10 [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:font-mono [&_.ProseMirror_code]:text-[0.9em]",
  "[&_.ProseMirror_pre_code]:bg-transparent [&_.ProseMirror_pre_code]:p-0",
  "[&_.ProseMirror_table]:my-4 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:border [&_.ProseMirror_table]:border-border",
  "[&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-border [&_.ProseMirror_th]:bg-muted [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:text-left [&_.ProseMirror_th]:font-semibold",
  "[&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-border [&_.ProseMirror_td]:p-2 [&_.ProseMirror_td]:align-top",
);

function getVideoEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname.includes("youtube.com") ||
      parsed.hostname.includes("youtu.be")
    ) {
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
  const reportedRef = useRef(false);
  const onScrolledToBottomRef = useRef(onScrolledToBottom);
  onScrolledToBottomRef.current = onScrolledToBottom;
  const content = (block.content ?? {}) as Record<string, unknown>;
  const body = content.body as Record<string, unknown> | undefined;

  useEffect(() => {
    reportedRef.current = false;
  }, [block.id]);

  useEffect(() => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    onScrolledToBottomRef.current();
  }, [block.id]);

  return (
    <div className="pr-2">
      <RichContentBlock
        json={body ?? null}
        plainText=""
        textTone="theme"
        className={LEARNING_TEXT_CONTENT_CLASSNAME}
        paragraphSpacing
      />
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
    return (
      <p className="text-sm text-muted-foreground">Video URL not configured.</p>
    );
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
  const label = content.label ?? "Lesson file";
  const fileUrl = block.id
    ? `/api/ucat/learning-modules/blocks/${encodeURIComponent(block.id)}/file`
    : content.url;
  const downloadUrl = fileUrl
    ? `${fileUrl}${fileUrl.includes("?") ? "&" : "?"}download=1`
    : null;

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
      {fileUrl ? (
        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm" onClick={markViewed}>
            <a href={downloadUrl ?? fileUrl} target="_blank" rel="noreferrer">
              <Download className="mr-2 h-4 w-4" />
              download
            </a>
          </Button>
        </div>
      ) : null}
      {fileUrl ? (
        <iframe
          src={fileUrl}
          title={label}
          className="h-[50vh] w-full rounded-lg border"
          onLoad={markViewed}
        />
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
}: {
  block: LearningModuleBlockRow;
  onBlockProgress: (
    blockId: string,
    completed: boolean,
    interactionState?: Json,
  ) => void;
  onSkillTrainerComplete: (blockId: string) => void;
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
            onBlockProgress(block.id!, percent >= 50, {
              videoWatchPercent: percent,
            })
          }
        />
      ) : null}
      {block.block_type === "file" && block.id ? (
        <FileBlock
          block={block}
          onViewed={() =>
            onBlockProgress(block.id!, true, { fileViewed: true })
          }
        />
      ) : null}
      {block.block_type === "question_stem" ||
      block.block_type === "question" ? (
        <LearnQuestionBlock
          block={block}
          onProgressChange={() => {
            if (!block.id) return;
            onBlockProgress(block.id, true, {
              completedFromQuestionEngine: true,
            });
          }}
        />
      ) : null}
      {block.block_type === "skill_trainer" && block.id ? (
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
  const updateProgress = useUpdateBlockProgress(lessonId);
  const markBlockComplete = useMarkBlockComplete(lessonId);
  const markLessonComplete = useMarkLessonComplete(lessonId);
  const resetLessonProgress = useResetLessonProgress(lessonId);
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [incompleteDialogOpen, setIncompleteDialogOpen] = useState(false);
  const blockRefs = useRef(new Map<string, HTMLDivElement>());
  const { openQuotaLimit } = useQuotaLimitDialog();
  const { reportActivityCompletion } = useStudyPlanCompanion();
  const previousLessonCompleteRef = useRef<boolean | null>(null);

  useEffect(() => {
    setActiveIndex(0);
    previousLessonCompleteRef.current = null;
  }, [lessonId]);

  useEffect(() => {
    if (!(error instanceof QuotaExceededError)) return;
    openQuotaLimit(error.payload, {
      dismissAction: quotaRouteFallback("learn"),
    });
  }, [error, openQuotaLimit]);

  useEffect(() => {
    if (!data?.module.started_at) return;
    void queryClient.invalidateQueries({ queryKey: learningKeys.modules() });
    void queryClient.invalidateQueries({ queryKey: ["ucat-quota-usage"] });
  }, [data?.module.started_at, queryClient]);

  const blocks = useMemo(() => data?.blocks ?? [], [data?.blocks]);
  const lesson = data?.module;
  const completionPercent = Number(lesson?.completion_percent ?? 0);
  const isLessonComplete =
    lesson?.completed_at != null || completionPercent >= 100;

  useEffect(() => {
    if (!lesson) return;
    const previous = previousLessonCompleteRef.current;
    previousLessonCompleteRef.current = isLessonComplete;
    if (previous !== false || !isLessonComplete) return;
    reportActivityCompletion({
      title: "Learning module complete",
      detail: lesson.title ?? "Your module progress has been saved.",
    });
  }, [isLessonComplete, lesson, reportActivityCompletion]);

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
    void queryClient.invalidateQueries({
      queryKey: learningKeys.lesson(lessonId),
    });
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
      setActiveIndex(index);
      const block = blocks[index];
      if (!block?.id) return;
      const element = blockRefs.current.get(block.id);
      element?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [blocks],
  );

  const handleMarkBlockComplete = useCallback(
    (blockId: string) => {
      markBlockComplete.mutate(blockId, {
        onSuccess: refreshLessonProgress,
      });
    },
    [markBlockComplete, refreshLessonProgress],
  );

  const setBlockRef = useCallback(
    (blockId: string, element: HTMLDivElement | null) => {
      if (element) {
        blockRefs.current.set(blockId, element);
        return;
      }
      blockRefs.current.delete(blockId);
    },
    [],
  );

  const handleConfirmMarkComplete = useCallback(() => {
    markLessonComplete.mutate(undefined, {
      onSuccess: () => {
        previousLessonCompleteRef.current = true;
        reportActivityCompletion({
          title: "Learning module complete",
          detail: lesson?.title ?? "Your module progress has been saved.",
        });
        setCompleteDialogOpen(false);
        setActiveIndex(0);
      },
    });
  }, [lesson?.title, markLessonComplete, reportActivityCompletion]);

  const handleConfirmMarkIncomplete = useCallback(() => {
    resetLessonProgress.mutate(undefined, {
      onSuccess: () => {
        setIncompleteDialogOpen(false);
        setActiveIndex(0);
      },
    });
  }, [resetLessonProgress]);

  if (isLoading) {
    return <LearningLessonPageSkeleton />;
  }
  if (error instanceof QuotaExceededError) {
    return (
      <p className="text-sm text-muted-foreground">
        Learning module limit reached.
      </p>
    );
  }
  if (error || !lesson) {
    return <p className="text-sm text-destructive">Lesson not found.</p>;
  }

  return (
    <motion.div
      className="mx-auto w-full max-w-7xl"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-6">
          <motion.div id="tour-learning-content" variants={itemVariants}>
            <UcatPageHeader
              title={lesson.title ?? "Lesson"}
              description={lesson.description ?? undefined}
              backHref="/learn"
              backLabel="All modules"
              breadcrumbItems={breadcrumbItems}
            />
          </motion.div>

          <motion.div className="space-y-10" variants={itemVariants}>
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
                  />
                </div>
              ) : null,
            )}
          </motion.div>
        </div>

        <motion.div id="tour-learning-progress" variants={itemVariants}>
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
