import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextResponse } from "next/server";
import { requireStudentAdminClient } from "@/lib/ucat/skill-trainer/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStudentAdminClient();
  if (!auth.ok) return auth.response;

  const [trainersResult, sectionsResult, configResult] = await Promise.all([
    auth.admin
      .from("ucat_skill_trainers")
      .select("id, key, name, description, icon, ucat_section_id, sort_order")
      .eq("is_enabled", true)
      .order("sort_order"),
    auth.admin.from("ucat_sections").select("id, name, section_number"),
    auth.admin
      .from("ucat_skill_trainer_config")
      .select("skill_trainer_id, time_limit_seconds, streak_enabled"),
  ]);

  const error = trainersResult.error ?? sectionsResult.error ?? configResult.error;

  if (error) {
    captureApiError(error, "/api/ucat/skill-trainers");
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sectionsById = new Map(
    (sectionsResult.data ?? []).map((section) => [section.id, section]),
  );
  const configByTrainerId = new Map(
    (configResult.data ?? []).map((config) => [config.skill_trainer_id, config]),
  );

  const trainers = (trainersResult.data ?? []).flatMap((trainer) => {
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

  return NextResponse.json(
    { trainers },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
