import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  BlockProgressPayload,
  LearningLessonDetail,
  LearningModuleRow,
} from "@/features/learning/types";

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Request failed");
  }
  return response.json() as Promise<T>;
}

export const learningApi = {
  async listModules(): Promise<LearningModuleRow[]> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("vstudent_ucat_learning_modules")
      .select("*")
      .order("index", { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  async getLesson(lessonId: string): Promise<LearningLessonDetail> {
    const response = await fetch(`/api/ucat/learning-modules/${lessonId}`);
    return parseJson<LearningLessonDetail>(response);
  },

  async startLesson(lessonId: string): Promise<{ created: boolean }> {
    const response = await fetch(`/api/ucat/learning-modules/${lessonId}/start`, {
      method: "POST",
    });
    return parseJson<{ created: boolean }>(response);
  },

  async updateBlockProgress(
    blockId: string,
    payload: BlockProgressPayload,
  ): Promise<void> {
    const response = await fetch(
      `/api/ucat/learning-modules/blocks/${blockId}/progress`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    await parseJson(response);
  },

  async markBlockComplete(blockId: string): Promise<void> {
    const response = await fetch(
      `/api/ucat/learning-modules/blocks/${blockId}/complete`,
      { method: "POST" },
    );
    await parseJson(response);
  },

  async markLessonComplete(lessonId: string): Promise<void> {
    const response = await fetch(`/api/ucat/learning-modules/${lessonId}/complete`, {
      method: "POST",
    });
    await parseJson(response);
  },
};
