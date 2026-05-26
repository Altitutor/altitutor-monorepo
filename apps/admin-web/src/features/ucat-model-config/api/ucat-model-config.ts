import { getSupabaseClient } from "@/shared/lib/supabase/client";
import type { Database, Tables } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export type UcatModelConfigRow = Tables<"ucat_model_config">;
export type UcatSectionRow = Tables<"ucat_sections">;

export type UcatModelConfigWithSection = UcatModelConfigRow & {
  sectionName: string;
  sectionNumber: number;
};

export type UcatModelConfigUpdate = Pick<
  UcatModelConfigRow,
  "k_prior" | "s_inf_uplift" | "r_noise" | "p0"
>;

export const ucatModelConfigApi = {
  async getAll(): Promise<UcatModelConfigWithSection[]> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const [configRes, sectionRes] = await Promise.all([
      supabase
        .from("ucat_model_config")
        .select("*")
        .order("updated_at", { ascending: true }),
      supabase
        .from("ucat_sections")
        .select("id, name, section_number")
        .gte("section_number", 1)
        .lte("section_number", 3)
        .order("section_number", { ascending: true }),
    ]);

    if (configRes.error) throw configRes.error;
    if (sectionRes.error) throw sectionRes.error;

    const sectionById = new Map(
      (sectionRes.data ?? []).map((s) => [s.id, s as UcatSectionRow]),
    );

    return (configRes.data ?? [])
      .map((row) => {
        const section = sectionById.get(row.section_id);
        if (!section) return null;
        return {
          ...row,
          sectionName: section.name,
          sectionNumber: section.section_number,
        };
      })
      .filter((row): row is UcatModelConfigWithSection => row !== null)
      .sort((a, b) => a.sectionNumber - b.sectionNumber);
  },

  async update(id: string, updates: UcatModelConfigUpdate): Promise<void> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { error } = await supabase
      .from("ucat_model_config")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;
  },
};
