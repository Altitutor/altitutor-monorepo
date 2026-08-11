import "server-only";

import type { Database, Json } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PreparationForecastHistorySnapshot } from "@/features/preparation/lib/forecast-evidence";
import type { PreparationEngineResult } from "@/features/preparation/model/types";

function requireAdmin() {
  if (!supabaseAdmin) throw new Error("Supabase admin client is unavailable.");
  return supabaseAdmin;
}

export async function hasPreparationSnapshot(
  supabase: SupabaseClient<Database>,
  snapshotDate: string,
  versions: PreparationEngineResult["versions"],
): Promise<boolean> {
  const { data, error } = await supabase
    .from("vstudent_ucat_preparation_snapshots")
    .select("snapshot_date")
    .eq("snapshot_date", snapshotDate)
    .eq("engine_version", versions.engine)
    .eq("policy_version", versions.policy)
    .eq("score_model_version", versions.scoreModel)
    .eq("trajectory_model_version", versions.trajectoryModel)
    .maybeSingle();
  if (error) throw error;
  return data != null;
}

export async function loadPreparationSnapshotHistory(
  supabase: SupabaseClient<Database>,
): Promise<PreparationForecastHistorySnapshot[]> {
  const { data, error } = await supabase
    .from("vstudent_ucat_preparation_snapshots")
    .select("generated_at, snapshot")
    .order("generated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).flatMap((row) =>
    row.generated_at
      ? [
          {
            generatedAt: row.generated_at,
            projectionSnapshot: row.snapshot,
          },
        ]
      : [],
  );
}

export async function loadLatestPreparationSnapshot(
  supabase: SupabaseClient<Database>,
  versions: PreparationEngineResult["versions"],
): Promise<unknown | null> {
  const { data, error } = await supabase
    .from("vstudent_ucat_preparation_snapshots")
    .select("snapshot")
    .eq("engine_version", versions.engine)
    .eq("policy_version", versions.policy)
    .eq("score_model_version", versions.scoreModel)
    .eq("trajectory_model_version", versions.trajectoryModel)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.snapshot ?? null;
}

export async function persistPreparationSnapshot(
  studentId: string,
  snapshotDate: string,
  preparation: PreparationEngineResult,
): Promise<void> {
  const { error } = await requireAdmin()
    .from("ucat_preparation_snapshots")
    .upsert(
      {
        student_id: studentId,
        snapshot_date: snapshotDate,
        engine_version: preparation.versions.engine,
        policy_version: preparation.versions.policy,
        score_model_version: preparation.versions.scoreModel,
        trajectory_model_version: preparation.versions.trajectoryModel,
        snapshot: {
          versions: preparation.versions,
          currentScore: preparation.currentScore,
          trajectory: preparation.trajectory,
        } as unknown as Json,
        generated_at: preparation.generatedAt,
      },
      {
        onConflict:
          "student_id,snapshot_date,engine_version,policy_version,score_model_version,trajectory_model_version",
      },
    );
  if (error) throw error;
}
