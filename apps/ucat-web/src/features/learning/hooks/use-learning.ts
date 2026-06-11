"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { learningApi } from "@/features/learning/api/learning-api";
import type { BlockProgressPayload } from "@/features/learning/types";

export const learningKeys = {
  all: ["learning"] as const,
  modules: () => [...learningKeys.all, "modules"] as const,
  lesson: (id: string) => [...learningKeys.all, "lesson", id] as const,
};

export function useLearningModules() {
  return useQuery({
    queryKey: learningKeys.modules(),
    queryFn: () => learningApi.listModules(),
  });
}

export function useLearningLesson(lessonId: string | null) {
  return useQuery({
    queryKey: learningKeys.lesson(lessonId ?? ""),
    queryFn: () => learningApi.getLesson(lessonId!),
    enabled: lessonId != null,
  });
}

export function useStartLesson(lessonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => learningApi.startLesson(lessonId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: learningKeys.lesson(lessonId) });
      queryClient.invalidateQueries({ queryKey: learningKeys.modules() });
      queryClient.invalidateQueries({ queryKey: ["quota-usage"] });
    },
  });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: learningKeys.lesson(lessonId) });
      queryClient.invalidateQueries({ queryKey: learningKeys.modules() });
    },
  });
}

export function useMarkBlockComplete(lessonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (blockId: string) => learningApi.markBlockComplete(blockId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: learningKeys.lesson(lessonId) });
      queryClient.invalidateQueries({ queryKey: learningKeys.modules() });
    },
  });
}

export function useMarkLessonComplete(lessonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => learningApi.markLessonComplete(lessonId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: learningKeys.lesson(lessonId) });
      queryClient.invalidateQueries({ queryKey: learningKeys.modules() });
    },
  });
}
