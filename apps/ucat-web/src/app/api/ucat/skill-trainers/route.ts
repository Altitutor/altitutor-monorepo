import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireStudentAdminClient } from "@/lib/ucat/skill-trainer/api-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const loadSkillTrainerCatalog = unstable_cache(
  async () => {
    if (!supabaseAdmin) throw new Error("Server read client not configured");
    const [trainersResult, sectionsResult, configResult] = await Promise.all([
      supabaseAdmin
        .from("ucat_skill_trainers")
        .select("id, key, name, description, icon, ucat_section_id, sort_order")
        .eq("is_enabled", true)
        .order("sort_order"),
      supabaseAdmin.from("ucat_sections").select("id, name, section_number"),
      supabaseAdmin
        .from("ucat_skill_trainer_config")
        .select("skill_trainer_id, time_limit_seconds, streak_enabled"),
    ]);

    const error =
      trainersResult.error ?? sectionsResult.error ?? configResult.error;
    if (error) throw new Error(error.message);

    const sectionsById = new Map(
      (sectionsResult.data ?? []).map((section) => [section.id, section]),
    );
    const configByTrainerId = new Map(
      (configResult.data ?? []).map((config) => [
        config.skill_trainer_id,
        config,
      ]),
    );

    return (trainersResult.data ?? []).flatMap((trainer) => {
      const section = sectionsById.get(trainer.ucat_section_id);
      const config = configByTrainerId.get(trainer.id);
      if (!section || !config) return [];

      return [
        {
          ...trainer,
          section_name: section.name,
          section_number: section.section_number,
          time_limit_seconds: config.time_limit_seconds,
          streak_enabled: config.streak_enabled,
        },
      ];
    });
  },
  ["ucat-skill-trainer-catalog-v1"],
  { revalidate: 300 },
);

export async function GET() {
  const auth = await requireStudentAdminClient();
  if (!auth.ok) return auth.response;

  try {
    const trainers = await loadSkillTrainerCatalog();
    return NextResponse.json(
      { trainers },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    captureApiError(error, "/api/ucat/skill-trainers");
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load trainers",
      },
      { status: 500 },
    );
  }
}
