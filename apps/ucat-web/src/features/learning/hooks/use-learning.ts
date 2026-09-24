"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { learningApi } from "@/features/learning/api/learning-api";
import type {
  BlockProgressPayload,
  LearningLessonDetail,
  LearningModuleBlockRow,
  LearningModuleRow,
} from "@/features/learning/types";

export const learningKeys = {
  all: ["learning"] as const,
  modules: () => [...learningKeys.all, "modules"] as const,
  lesson: (id: string) => [...learningKeys.all, "lesson", id] as const,
};

function invalidateLearningAndStudyPlan(
  queryClient: ReturnType<typeof useQueryClient>,
  lessonId: string,
) {
  void queryClient.invalidateQueries({
    queryKey: learningKeys.lesson(lessonId),
  });
  void queryClient.invalidateQueries({ queryKey: learningKeys.modules() });
  void queryClient.invalidateQueries({ queryKey: ["ucat-study-plan"] });
}

type LearningMutationContext = {
  previous: LearningLessonDetail | undefined;
};

function countCompletedBlocks(blocks: LearningModuleBlockRow[]): number {
  return blocks.filter((block) => block.block_completed_at != null).length;
}

function updateLessonSummary(
  module: LearningModuleRow,
  blocks: LearningModuleBlockRow[],
): LearningModuleRow {
  const completedBlocks = countCompletedBlocks(blocks);
  const completionPercent =
    blocks.length > 0 ? Math.round((completedBlocks / blocks.length) * 100) : 0;
  const now = new Date().toISOString();

  return {
    ...module,
    started_at: module.started_at ?? now,
    completion_percent: completionPercent,
    completed_at:
      blocks.length > 0 && completedBlocks === blocks.length
        ? (module.completed_at ?? now)
        : null,
  };
}

function syncModuleListCache(
  queryClient: ReturnType<typeof useQueryClient>,
  nextModule: LearningModuleRow,
) {
  queryClient.setQueryData<LearningModuleRow[] | undefined>(
    learningKeys.modules(),
    (current) =>
      current?.map((module) =>
        module.id === nextModule.id ? nextModule : module,
      ),
  );
}

function patchLessonCache(
  queryClient: ReturnType<typeof useQueryClient>,
  lessonId: string,
  updater: (current: LearningLessonDetail) => LearningLessonDetail,
): LearningMutationContext {
  const queryKey = learningKeys.lesson(lessonId);
  const previous = queryClient.getQueryData<LearningLessonDetail>(queryKey);

  if (!previous) {
    return { previous };
  }

  const next = updater(previous);
  queryClient.setQueryData(queryKey, next);
  syncModuleListCache(queryClient, next.module);

  return { previous };
}

function restoreLessonCache(
  queryClient: ReturnType<typeof useQueryClient>,
  lessonId: string,
  context: LearningMutationContext | undefined,
) {
  if (!context?.previous) return;
  queryClient.setQueryData(learningKeys.lesson(lessonId), context.previous);
  syncModuleListCache(queryClient, context.previous.module);
}

export function useLearningModules() {
  return useQuery({
    queryKey: learningKeys.modules(),
    queryFn: () => learningApi.listModules(),
  });
}

export function useLearningLesson(
  lessonId: string | null,
  studyPlanTaskId: string | null,
) {
  const start = useQuery({
    queryKey: [
      ...learningKeys.all,
      "lesson-start",
      lessonId ?? "",
      studyPlanTaskId ?? "independent",
    ],
    queryFn: () => learningApi.startLesson(lessonId!, studyPlanTaskId),
    enabled: lessonId != null,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const lesson = useQuery({
    queryKey: learningKeys.lesson(lessonId ?? ""),
    queryFn: () => learningApi.getLesson(lessonId!),
    enabled: lessonId != null && start.isSuccess,
  });
  return {
    ...lesson,
    isLoading: start.isPending || lesson.isPending,
    error: start.error ?? lesson.error,
  };
}

export function useUpdateBlockProgress(lessonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      blockId,
      payload,
    }: {
      blockId: string;
      payload: BlockProgressPayload;
    }) => learningApi.updateBlockProgress(blockId, payload),
    onMutate: async ({ blockId, payload }) => {
      await queryClient.cancelQueries({
        queryKey: learningKeys.lesson(lessonId),
      });
      await queryClient.cancelQueries({ queryKey: learningKeys.modules() });

      return patchLessonCache(queryClient, lessonId, (current) => {
        const blocks = current.blocks.map((block) =>
          block.id === blockId && payload.completed
            ? {
                ...block,
                block_completed_at:
                  block.block_completed_at ?? new Date().toISOString(),
              }
            : block,
        );

        return {
          ...current,
          module: updateLessonSummary(current.module, blocks),
          blocks,
        };
      });
    },
    onError: (_error, _variables, context) => {
      restoreLessonCache(queryClient, lessonId, context);
    },
    onSuccess: () => {
      invalidateLearningAndStudyPlan(queryClient, lessonId);
    },
  });
}

export function useMarkBlockComplete(lessonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (blockId: string) => learningApi.markBlockComplete(blockId),
    onMutate: async (blockId) => {
      await queryClient.cancelQueries({
        queryKey: learningKeys.lesson(lessonId),
      });
      await queryClient.cancelQueries({ queryKey: learningKeys.modules() });

      return patchLessonCache(queryClient, lessonId, (current) => {
        const blocks = current.blocks.map((block) =>
          block.id === blockId
            ? {
                ...block,
                block_completed_at:
                  block.block_completed_at ?? new Date().toISOString(),
              }
            : block,
        );

        return {
          ...current,
          module: updateLessonSummary(current.module, blocks),
          blocks,
        };
      });
    },
    onError: (_error, _variables, context) => {
      restoreLessonCache(queryClient, lessonId, context);
    },
    onSuccess: () => {
      invalidateLearningAndStudyPlan(queryClient, lessonId);
    },
  });
}

export function useMarkLessonComplete(lessonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => learningApi.markLessonComplete(lessonId),
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: learningKeys.lesson(lessonId),
      });
      await queryClient.cancelQueries({ queryKey: learningKeys.modules() });

      return patchLessonCache(queryClient, lessonId, (current) => {
        const now = new Date().toISOString();
        const blocks = current.blocks.map((block) => ({
          ...block,
          block_completed_at: block.block_completed_at ?? now,
        }));

        return {
          ...current,
          module: {
            ...updateLessonSummary(current.module, blocks),
            completed_at: current.module.completed_at ?? now,
          },
          blocks,
        };
      });
    },
    onError: (_error, _variables, context) => {
      restoreLessonCache(queryClient, lessonId, context);
    },
    onSuccess: () => {
      invalidateLearningAndStudyPlan(queryClient, lessonId);
    },
  });
}

export function useResetLessonProgress(lessonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => learningApi.resetLessonProgress(lessonId),
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: learningKeys.lesson(lessonId),
      });
      await queryClient.cancelQueries({ queryKey: learningKeys.modules() });

      return patchLessonCache(queryClient, lessonId, (current) => {
        const blocks = current.blocks.map((block) => ({
          ...block,
          block_completed_at: null,
        }));

        return {
          ...current,
          module: {
            ...updateLessonSummary(current.module, blocks),
            completed_at: null,
          },
          blocks,
        };
      });
    },
    onError: (_error, _variables, context) => {
      restoreLessonCache(queryClient, lessonId, context);
    },
    onSuccess: () => {
      invalidateLearningAndStudyPlan(queryClient, lessonId);
    },
  });
}
