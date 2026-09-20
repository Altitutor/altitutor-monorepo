import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { StudyPlanResponse } from "@/features/study-plan/model/types";
import type { UcatQuotaUsageResponse } from "@/features/ucat-access/types/quota";
import type {
  SectionProgress,
  SetAttemptRow,
  MockAttemptRow,
  PracticeAttemptRow,
} from "@altitutor/shared";
export type Profile = {
  firstName: string;
  lastName: string;
  email: string;
  timezone: string;
  timezoneOptions: string[];
};
export type Attempt =
  | ({ source: "set" } & SetAttemptRow)
  | ({ source: "mock" } & MockAttemptRow)
  | ({ source: "practice" } & PracticeAttemptRow);
export const dataApi = {
  profile: () => api<Profile>("/profile"),
  plan: () => api<StudyPlanResponse>("/study-plan"),
  quota: () => api<UcatQuotaUsageResponse>("/quota-usage"),
  progress: () =>
    api<{ sectionProgress: SectionProgress[] }>("/progress/summary"),
  attempts: (page = 1) =>
    api<{ attempts: Attempt[]; total: number }>(
      `/progress/attempts?source=all&completedOnly=true&page=${page}&pageSize=20`,
    ),
  async sections() {
    const { data, error } = await supabase
      .from("vstudent_ucat_sections")
      .select("id,name,section_number,time_per_question")
      .order("section_number");
    if (error) throw error;
    return (data ?? []).map((s) => ({
      id: s.id ?? "",
      name: s.name ?? "Section",
      sectionNumber: s.section_number ?? 0,
      timePerQuestion: s.time_per_question,
    }));
  },
  async modules() {
    const { data, error } = await supabase
      .from("vstudent_ucat_learning_modules")
      .select("*")
      .order("index");
    if (error) throw error;
    return data ?? [];
  },
  async sets() {
    const { data, error } = await supabase
      .from("vstudent_ucat_question_sets")
      .select("*")
      .eq("is_available_in_sets_library", true)
      .order("section_number")
      .order("catalog_index");
    if (error) throw error;
    return data ?? [];
  },
  async mocks() {
    const { data, error } = await supabase
      .from("vstudent_ucat_mocks")
      .select("*")
      .order("catalog_index");
    if (error) throw error;
    return data ?? [];
  },
};
export function attemptTitle(a: Attempt) {
  return a.source === "set"
    ? (a.questionSetName ?? "Question set")
    : a.source === "mock"
      ? (a.mockName ?? "Mock exam")
      : `${a.sectionName} practice`;
}
