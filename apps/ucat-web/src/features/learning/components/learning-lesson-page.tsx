"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Json } from "@altitutor/shared";
import type { UcatBreadcrumbItem } from "@/features/layout/components/ucat-page-header";
import { UcatPageHeader } from "@/features/layout";
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
import { LearningTextBlock } from "@/features/learning/components/learning-text-block";
import { formatBlockLabel } from "@/features/learning/lib/format-block-label";
import { buildLessonAncestorPath } from "@/features/learning/lib/build-lesson-ancestors";
import { getAdjacentLessons } from "@/features/learning/lib/flatten-lessons-for-nav";
import { SECTION_NUMBER_TO_NAME } from "@/features/sets/lib/section-labels";
import { quotaRouteFallback } from "@/features/ucat-access/lib/quota-route-fallback";
import type { LearningModuleBlockRow } from "@/features/learning/types";
import { QuotaExceededError } from "@/lib/ucat/quota/parse-quota-error";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

type LearningLessonPageProps = {
  lessonId: string;
  sectionNumber: number | null;
};

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
  questionBlockStarted,
  questionBlockActive,
  questionBlockComplete,
  onActivateQuestionBlock,
}: {
  block: LearningModuleBlockRow;
  onBlockProgress: (
    blockId: string,
    completed: boolean,
    interactionState?: Json,
  ) => void;
  onSkillTrainerComplete: (blockId: string) => void;
  questionBlockStarted: boolean;
  questionBlockActive: boolean;
  questionBlockComplete: boolean;
  onActivateQuestionBlock: () => void;
}) {
  return (
    <>
      {block.block_type === "text" && block.id ? (
        <LearningTextBlock
          block={block}
          onViewed={() => onBlockProgress(block.id!, true)}
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
          started={questionBlockStarted}
          active={questionBlockActive}
          completed={questionBlockComplete}
          onActivate={onActivateQuestionBlock}
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

export function LearningLessonPage({
  lessonId,
  sectionNumber,
}: LearningLessonPageProps) {
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
  const [activeQuestionBlockId, setActiveQuestionBlockId] = useState<
    string | null
  >(null);
  const [startedQuestionBlockIds, setStartedQuestionBlockIds] = useState(
    () => new Set<string>(),
  );
  const blockRefs = useRef(new Map<string, HTMLDivElement>());
  const { openQuotaLimit } = useQuotaLimitDialog();
  const { reportActivityCompletion, setActivityComplete } =
    useStudyPlanCompanion();
  const previousLessonCompleteRef = useRef<boolean | null>(null);

  useEffect(() => {
    setActiveIndex(0);
    setActiveQuestionBlockId(null);
    setStartedQuestionBlockIds(new Set());
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
    setActivityComplete(isLessonComplete);
    return () => setActivityComplete(false);
  }, [isLessonComplete, setActivityComplete]);

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

  const { next: nextLesson } = useMemo(
    () => getAdjacentLessons(lessonId, allModules ?? []),
    [allModules, lessonId],
  );

  const sectionHref =
    sectionNumber == null
      ? "/learn/general"
      : `/learn/sections/${sectionNumber}`;
  const sectionLabel =
    lesson?.section_name ??
    (sectionNumber == null
      ? "General"
      : (SECTION_NUMBER_TO_NAME[sectionNumber] ?? `Section ${sectionNumber}`));

  const breadcrumbItems = useMemo((): UcatBreadcrumbItem[] => {
    const items: UcatBreadcrumbItem[] = [
      { label: "Learn", href: "/learn" },
      { label: sectionLabel, href: sectionHref },
    ];
    for (const folder of buildLessonAncestorPath(lessonId, allModules ?? [])) {
      if (folder.title) {
        items.push({
          label: folder.title,
          href: `${sectionHref}#folder-${folder.id}`,
        });
      }
    }
    if (lesson?.title) {
      items.push({ label: lesson.title });
    }
    return items;
  }, [allModules, lesson?.title, lessonId, sectionHref, sectionLabel]);

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
          label: formatBlockLabel(block),
        };
      }),
    [blocks, incompleteBlocks],
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
              backHref={sectionHref}
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
                    questionBlockStarted={startedQuestionBlockIds.has(block.id)}
                    questionBlockActive={activeQuestionBlockId === block.id}
                    questionBlockComplete={isBlockComplete(block)}
                    onActivateQuestionBlock={() => {
                      setStartedQuestionBlockIds((current) =>
                        new Set(current).add(block.id!),
                      );
                      setActiveQuestionBlockId(block.id!);
                    }}
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
            isBlockComplete={isBlockComplete}
            onSelectBlock={goToBlock}
            onMarkBlockComplete={handleMarkBlockComplete}
            onRequestMarkComplete={() => setCompleteDialogOpen(true)}
            onRequestMarkIncomplete={() => setIncompleteDialogOpen(true)}
            isResettingProgress={resetLessonProgress.isPending}
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
