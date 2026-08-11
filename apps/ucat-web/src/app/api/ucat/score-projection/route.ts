import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_HORIZONS } from "@/features/score-projection/lib/model";
import type {
  HistoricalProjectionPoint,
  ProjectionConfidence,
  ScoreProjectionResponse,
  ScoreProjectionSnapshot,
} from "@/features/score-projection/types/score-projection";
import { deriveTotalScoreProjection } from "@/features/score-projection/lib/total-projection";
import { onlySnapshotsForModel } from "@/features/score-projection/lib/snapshot-history";
import {
  allocateTotalAcrossSections,
  readCompatibleCanonicalTrajectory,
} from "@/features/score-projection/lib/canonical-trajectory-adapter";
import { loadLatestPreparationSnapshot } from "@/features/preparation/server/preparation-snapshot";
import {
  CURRENT_PREPARATION_VERSIONS,
  estimateRepresentativeScore,
  parseRepresentativeScoreEvidence,
  REPRESENTATIVE_SCORE_EVIDENCE_SELECT,
  type RepresentativeScoreEvidence,
} from "@/features/preparation";

const SNAPSHOT_LOOKBACK_DAYS = 365;

type SectionRow = {
  id: string | null;
  name: string | null;
  section_number: number | null;
};

type ResolvedSection = {
  id: string;
  name: string;
  sectionNumber: number;
};

type SnapshotRow = {
  student_id: string;
  snapshot_date: string;
  current_estimate: number;
  confidence: ProjectionConfidence;
  uncertainty: number;
  effective_evidence_weight: number;
  section_estimates: unknown;
  generated_at: string;
  model_version: string;
};

type SnapshotWrite = SnapshotRow;

type SnapshotFilter = {
  eq: (
    column: "student_id" | "model_version",
    value: string,
  ) => SnapshotFilter;
  gte: (column: "snapshot_date", value: string) => SnapshotFilter;
  order: (
    column: "snapshot_date",
    options: { ascending: boolean },
  ) => Promise<{ data: SnapshotRow[] | null; error: Error | null }>;
};

type SnapshotStore = {
  from: (relation: "ucat_score_projection_snapshots") => {
    select: (columns: string) => SnapshotFilter;
    upsert: (
      row: SnapshotWrite,
      options: {
        onConflict: "student_id,snapshot_date,model_version";
      },
    ) => Promise<{ error: Error | null }>;
  };
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function readSectionEstimates(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([sectionId, estimate]) =>
      typeof estimate === "number" ? [[sectionId, estimate]] : [],
    ),
  );
}

function toSnapshot(row: SnapshotRow): ScoreProjectionSnapshot {
  return {
    modelVersion: row.model_version,
    date: row.snapshot_date,
    currentEstimate: row.current_estimate,
    confidence: row.confidence,
    uncertainty: row.uncertainty,
    effectiveEvidenceWeight: row.effective_evidence_weight,
    sectionEstimates: readSectionEstimates(row.section_estimates),
  };
}

function snapshotsDiffer(left: SnapshotRow | undefined, right: SnapshotWrite) {
  if (!left) return true;
  return (
    left.current_estimate !== right.current_estimate ||
    left.confidence !== right.confidence ||
    left.uncertainty !== right.uncertainty ||
    left.effective_evidence_weight !== right.effective_evidence_weight ||
    left.model_version !== right.model_version ||
    JSON.stringify(readSectionEstimates(left.section_estimates)) !==
      JSON.stringify(right.section_estimates)
  );
}

async function captureDailySnapshot(
  userId: string,
  payload: ScoreProjectionResponse,
  generatedAt: Date,
): Promise<ScoreProjectionSnapshot[]> {
  if (!supabaseAdmin) return [];

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, timezone")
    .eq("user_id", userId)
    .maybeSingle();
  if (studentError || !student) {
    console.warn(
      "[score-projection] Snapshot student lookup failed",
      studentError,
    );
    return [];
  }

  const snapshotStore = supabaseAdmin as unknown as SnapshotStore;
  const lookback = new Date(generatedAt);
  lookback.setUTCDate(lookback.getUTCDate() - SNAPSHOT_LOOKBACK_DAYS);
  const { data, error } = await snapshotStore
    .from("ucat_score_projection_snapshots")
    .select(
      "student_id, snapshot_date, current_estimate, confidence, uncertainty, effective_evidence_weight, section_estimates, generated_at, model_version",
    )
    .eq("student_id", student.id)
    .eq("model_version", payload.modelVersion)
    .gte("snapshot_date", isoDate(lookback))
    .order("snapshot_date", { ascending: true });
  if (error) {
    // The dashboard still works during a migration rollout; it simply starts
    // building trusted history once the snapshot table is available.
    console.warn("[score-projection] Snapshot history unavailable", error);
    return [];
  }

  const rows = onlySnapshotsForModel(data ?? [], payload.modelVersion);
  const total = deriveTotalScoreProjection(payload.sections);
  if (
    total.currentEstimate == null ||
    total.confidence == null ||
    total.uncertainty == null
  ) {
    return rows.map(toSnapshot);
  }

  const snapshotDate = dateInTimeZone(
    generatedAt,
    student.timezone ?? "Australia/Adelaide",
  );
  const sectionEstimates = Object.fromEntries(
    payload.sections.flatMap((section) =>
      section.sectionNumber <= 3 && section.currentEstimate != null
        ? [[section.sectionId, section.currentEstimate]]
        : [],
    ),
  );
  const nextRow: SnapshotWrite = {
    student_id: student.id,
    snapshot_date: snapshotDate,
    current_estimate: total.currentEstimate,
    confidence: total.confidence,
    uncertainty: total.uncertainty,
    effective_evidence_weight:
      Math.round(total.effectiveEvidenceWeight * 100) / 100,
    section_estimates: sectionEstimates,
    generated_at: payload.generatedAt,
    model_version: payload.modelVersion,
  };
  const currentRow = rows.find((row) => row.snapshot_date === snapshotDate);

  if (snapshotsDiffer(currentRow, nextRow)) {
    const { error: writeError } = await snapshotStore
      .from("ucat_score_projection_snapshots")
      .upsert(nextRow, { onConflict: "student_id,snapshot_date,model_version" });
    if (writeError) {
      console.warn("[score-projection] Snapshot write failed", writeError);
      return rows.map(toSnapshot);
    }
  }

  return [
    ...rows.filter((row) => row.snapshot_date !== snapshotDate).map(toSnapshot),
    toSnapshot(nextRow),
  ].sort((left, right) => left.date.localeCompare(right.date));
}

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [sectionsRes, evidenceRes, generationRes, preparationSnapshot] =
    await Promise.all([
      supabase
        .from("vstudent_ucat_sections")
        .select("id, name, section_number")
        .order("section_number"),
      supabase
        .from("vstudent_ucat_score_projection_evidence")
        .select(REPRESENTATIVE_SCORE_EVIDENCE_SELECT),
      supabase
        .from("vstudent_ucat_study_plan_generations")
        .select("projection_snapshot")
        .is("superseded_at", null)
        .maybeSingle(),
      loadLatestPreparationSnapshot(
        supabase,
        CURRENT_PREPARATION_VERSIONS,
      ),
    ]);

  if (sectionsRes.error) {
    return NextResponse.json(
      { error: sectionsRes.error.message },
      { status: 500 },
    );
  }
  if (evidenceRes.error) {
    return NextResponse.json(
      { error: evidenceRes.error.message },
      { status: 500 },
    );
  }
  if (generationRes.error) {
    return NextResponse.json(
      { error: generationRes.error.message },
      { status: 500 },
    );
  }
  const generationSnapshot = generationRes.data?.projection_snapshot;
  const canonicalSnapshot = generationSnapshot ?? preparationSnapshot;
  const canonicalTrajectory = readCompatibleCanonicalTrajectory(
    canonicalSnapshot,
    CURRENT_PREPARATION_VERSIONS,
  );
  const sections: ResolvedSection[] = ((sectionsRes.data ?? []) as SectionRow[])
    .flatMap((section) => {
      if (
        !section.id ||
        !section.name ||
        section.section_number == null ||
        section.section_number < 1 ||
        section.section_number > 4
      ) {
        return [];
      }
      return [
        {
          id: section.id,
          name: section.name,
          sectionNumber: section.section_number,
        },
      ];
    })
    .sort((a, b) => a.sectionNumber - b.sectionNumber);

  const scoreEvidence: RepresentativeScoreEvidence[] = [];

  for (const row of evidenceRes.data ?? []) {
    const item = parseRepresentativeScoreEvidence(row);
    if (!item) continue;
    scoreEvidence.push(item);
  }

  const generatedAt = new Date();
  const representativeEstimate = estimateRepresentativeScore({
    now: generatedAt.toISOString(),
    modelVersion: CURRENT_PREPARATION_VERSIONS.scoreModel,
    evidence: scoreEvidence,
  });
  const representativeBySection = new Map(
    [
      ...representativeEstimate.sections,
      ...(representativeEstimate.situationalJudgement
        ? [representativeEstimate.situationalJudgement]
        : []),
    ].map((section) => [section.sectionId, section]),
  );
  const cognitiveEstimates = sections.flatMap((section) => {
    const estimate = representativeBySection.get(section.id)?.currentEstimate;
    return section.sectionNumber <= 3 && estimate != null
      ? [{ sectionId: section.id, currentEstimate: estimate }]
      : [];
  });
  const canonicalAvailable =
    canonicalTrajectory?.status === "available" &&
    cognitiveEstimates.length === 3
      ? canonicalTrajectory
      : null;
  const allocatedProjection = new Map(
    (canonicalAvailable?.points ?? []).map((point) => [
      point.day,
      {
        point,
        lower: allocateTotalAcrossSections(point.lower, cognitiveEstimates),
        middle: allocateTotalAcrossSections(point.middle, cognitiveEstimates),
        upper: allocateTotalAcrossSections(point.upper, cognitiveEstimates),
      },
    ]),
  );
  const allocatedHistory = new Map(
    (canonicalAvailable?.history ?? []).map((point) => [
      point.date,
      allocateTotalAcrossSections(point.currentEstimate, cognitiveEstimates),
    ]),
  );
  const payload: ScoreProjectionResponse = {
    modelVersion: CURRENT_PREPARATION_VERSIONS.trajectoryModel,
    generatedAt: generatedAt.toISOString(),
    horizons: [...DEFAULT_HORIZONS],
    snapshots: [],
    sections: sections.map((section) => {
      const estimate = representativeBySection.get(section.id);
      const projection = [...allocatedProjection.values()].map((allocated) => ({
        day: allocated.point.day,
        date: allocated.point.date,
        pessimistic: allocated.lower[section.id]!,
        realistic: allocated.middle[section.id]!,
        optimistic: allocated.upper[section.id]!,
      }));
      const history: HistoricalProjectionPoint[] = [
        ...allocatedHistory.entries(),
      ].map(([date, allocated]) => ({
        date,
        value: allocated[section.id]!,
        confidence: estimate?.confidence ?? "low",
        uncertainty: estimate?.uncertainty ?? 90,
        effectiveEvidenceWeight:
          estimate?.representativeSectionEquivalents ?? 0,
      }));

      return {
        sectionId: section.id,
        sectionName: section.name,
        sectionNumber: section.sectionNumber,
        currentEstimate: estimate?.currentEstimate ?? null,
        confidence: estimate?.confidence ?? "low",
        uncertainty: estimate?.uncertainty ?? 90,
        effectiveEvidenceWeight:
          estimate?.representativeSectionEquivalents ?? 0,
        evidenceCount: estimate?.qualifyingEvidenceCount ?? 0,
        paceSource:
          canonicalAvailable?.doseSource === "recent_sustained_workload"
            ? ("recent_activity" as const)
            : ("default" as const),
        effectivePracticePerWeek:
          canonicalAvailable?.coreSectionEquivalentsPerWeek ?? 0,
        history,
        projection,
        horizons: DEFAULT_HORIZONS.flatMap((day) => {
          const point = projection.find((candidate) => candidate.day === day);
          return point
            ? [
                {
                  day,
                  pessimistic: point.pessimistic,
                  realistic: point.realistic,
                  optimistic: point.optimistic,
                },
              ]
            : [];
        }),
      };
    }),
  };

  payload.snapshots = await captureDailySnapshot(user.id, payload, generatedAt);

  return NextResponse.json(payload);
}
