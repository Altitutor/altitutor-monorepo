import "server-only";

import type { Database, Json } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PreparationForecastHistorySnapshot } from "@/features/preparation/lib/forecast-evidence";
import type { PreparationEngineResult } from "@/features/preparation/model/types";

export type PreparationProjectionSnapshot = Pick<
  PreparationEngineResult,
  "generatedAt" | "versions" | "currentScore" | "trajectory"
>;

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
    .select("generated_at, snapshot_date, snapshot")
    .order("generated_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).flatMap((row) =>
    row.generated_at
      ? [
          {
            generatedAt: row.generated_at,
            snapshotDate: row.snapshot_date ?? undefined,
            projectionSnapshot: row.snapshot,
          },
        ]
      : [],
  );
}

export async function loadLatestPreparationSnapshot(
  supabase: SupabaseClient<Database>,
  versions: PreparationEngineResult["versions"],
): Promise<PreparationProjectionSnapshot | null> {
  const { data, error } = await supabase
    .from("vstudent_ucat_preparation_snapshots")
    .select("generated_at, snapshot")
    .eq("engine_version", versions.engine)
    .eq("policy_version", versions.policy)
    .eq("score_model_version", versions.scoreModel)
    .eq("trajectory_model_version", versions.trajectoryModel)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.generated_at || !data.snapshot) return null;
  const snapshot = data.snapshot as unknown as Omit<
    PreparationProjectionSnapshot,
    "generatedAt"
  >;
  return { ...snapshot, generatedAt: data.generated_at };
}

export async function loadPreparationEvidenceWatermark(
  supabase: SupabaseClient<Database>,
): Promise<string | null> {
  const { data, error } = await supabase.rpc(
    "get_student_ucat_preparation_evidence_watermark",
  );
  if (error) throw error;
  return data;
}

export async function persistPreparationSnapshot(
  studentId: string,
  snapshotDate: string,
  preparation: PreparationEngineResult,
): Promise<void> {
  await persistPreparationProjectionSnapshot(studentId, snapshotDate, {
    generatedAt: preparation.generatedAt,
    versions: preparation.versions,
    currentScore: preparation.currentScore,
    trajectory: preparation.trajectory,
  });
}

export async function persistPreparationProjectionSnapshot(
  studentId: string,
  snapshotDate: string,
  preparation: PreparationProjectionSnapshot,
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
        // This timestamp is the freshness boundary for every input consumed by
        // Preparation. Record when persistence finishes rather than when the
        // calculation started so profile/plan writes completed during the run
        // cannot make the new snapshot look immediately stale.
        generated_at: new Date().toISOString(),
      },
      {
        onConflict:
          "student_id,snapshot_date,engine_version,policy_version,score_model_version,trajectory_model_version",
      },
    );
  if (error) throw error;
}
