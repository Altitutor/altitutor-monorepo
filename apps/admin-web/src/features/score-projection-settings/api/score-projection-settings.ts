import type { Database } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/shared/lib/supabase/client";

export type ScoreProjectionSettingsRow = {
  id: string;
  section_id: string;
  baseline_score: number;
  mock_source_weight: number;
  set_source_weight: number;
  practice_source_weight: number;
  timed_weight: number;
  slow_timed_weight: number;
  untimed_weight: number;
  recency_half_life_days: number;
  min_practice_scored_points: number;
  shrinkage_prior_weight: number;
  default_effective_questions_per_week: number;
  recent_activity_lookback_days: number;
  effective_practice_daily_cap: number;
  trajectory_horizon_days: number;
  trajectory_step_days: number;
  pessimistic_learning_rate: number;
  realistic_learning_rate: number;
  optimistic_learning_rate: number;
  pessimistic_ceiling_uplift: number;
  realistic_ceiling_uplift: number;
  optimistic_ceiling_uplift: number;
  updated_at: string;
};

export type ScoreProjectionSettingsWithSection = ScoreProjectionSettingsRow & {
  sectionName: string;
  sectionNumber: number;
};

export type ScoreProjectionSettingsUpdate = Omit<
  Partial<ScoreProjectionSettingsRow>,
  "id" | "section_id" | "updated_at"
>;

type SectionRow = {
  id: string;
  name: string;
  section_number: number;
};

export const scoreProjectionSettingsApi = {
  async getAll(): Promise<ScoreProjectionSettingsWithSection[]> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const [settingsRes, sectionRes] = await Promise.all([
      supabase
        .from("ucat_score_projection_settings")
        .select("*")
        .order("updated_at", { ascending: true }),
      supabase
        .from("ucat_sections")
        .select("id, name, section_number")
        .gte("section_number", 1)
        .lte("section_number", 3)
        .order("section_number", { ascending: true }),
    ]);

    if (settingsRes.error) throw settingsRes.error;
    if (sectionRes.error) throw sectionRes.error;

    const sectionById = new Map<string, SectionRow>(
      ((sectionRes.data ?? []) as SectionRow[]).map((section) => [
        section.id,
        section,
      ]),
    );

    return ((settingsRes.data ?? []) as ScoreProjectionSettingsRow[])
      .map((row) => {
        const section = sectionById.get(row.section_id);
        if (!section) return null;
        return {
          ...row,
          sectionName: section.name,
          sectionNumber: section.section_number,
        };
      })
      .filter((row): row is ScoreProjectionSettingsWithSection => row !== null)
      .sort((a, b) => a.sectionNumber - b.sectionNumber);
  },

  async update(id: string, updates: ScoreProjectionSettingsUpdate): Promise<void> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { error } = await supabase
      .from("ucat_score_projection_settings")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;
  },
};
