import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentPreparation } from "@/features/study-plan/server/study-plan-service";
import type {
  HistoricalProjectionPoint,
  ProjectionPoint,
  ScoreProjectionResponse,
  ScoreProjectionSnapshot,
} from "@/features/score-projection/types/score-projection";

const HORIZONS = [30, 60, 90, 120] as const;
const SECTION_SCORE_MIN = 300;
const SECTION_SCORE_MAX = 900;

function allocateTotalAcrossSections(
  total: number,
  estimates: Array<{ sectionId: string; currentEstimate: number }>,
): Record<string, number> {
  const currentTotal = estimates.reduce(
    (sum, section) => sum + section.currentEstimate,
    0,
  );
  const difference = total - currentTotal;
  const room = estimates.map((section) =>
    difference >= 0
      ? SECTION_SCORE_MAX - section.currentEstimate
      : section.currentEstimate - SECTION_SCORE_MIN,
  );
  const totalRoom = room.reduce((sum, value) => sum + value, 0);
  const allocated = estimates.map((section, index) =>
    Math.max(
      SECTION_SCORE_MIN,
      Math.min(
        SECTION_SCORE_MAX,
        Math.round(
          section.currentEstimate +
            difference *
              (totalRoom > 0 ? room[index]! / totalRoom : 1 / estimates.length),
        ),
      ),
    ),
  );
  let remainder = total - allocated.reduce((sum, value) => sum + value, 0);
  for (
    let index = 0;
    remainder !== 0 && index < allocated.length * 4;
    index++
  ) {
    const target = index % allocated.length;
    const direction = remainder > 0 ? 1 : -1;
    const next = allocated[target]! + direction;
    if (next < SECTION_SCORE_MIN || next > SECTION_SCORE_MAX) continue;
    allocated[target] = next;
    remainder -= direction;
  }
  return Object.fromEntries(
    estimates.map(
      (section, index) => [section.sectionId, allocated[index]!] as const,
    ),
  );
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

  try {
    const preparation = await getCurrentPreparation(supabase, user.id);
    const cognitiveSections = preparation.currentScore.sections;
    const responseSections = [
      ...cognitiveSections,
      ...(preparation.currentScore.situationalJudgement
        ? [preparation.currentScore.situationalJudgement]
        : []),
    ];
    const cognitive = cognitiveSections.flatMap((section) =>
      section.currentEstimate == null
        ? []
        : [
            {
              sectionId: section.sectionId,
              currentEstimate: section.currentEstimate,
            },
          ],
    );
    const canAllocate = cognitive.length === 3;
    const trajectory = preparation.trajectory;
    const trajectoryPoints =
      trajectory.status === "available" ? trajectory.points : [];
    const trajectoryHistory = trajectory.history;
    const allocatedPoints = canAllocate
      ? trajectoryPoints.map((point) => ({
          point,
          lower:
            point.sections &&
            Object.keys(point.sections).length === cognitive.length
              ? Object.fromEntries(
                  Object.entries(point.sections).map(([sectionId, section]) => [
                    sectionId,
                    section.lower,
                  ]),
                )
              : allocateTotalAcrossSections(point.lower, cognitive),
          middle:
            point.sections &&
            Object.keys(point.sections).length === cognitive.length
              ? Object.fromEntries(
                  Object.entries(point.sections).map(([sectionId, section]) => [
                    sectionId,
                    section.middle,
                  ]),
                )
              : allocateTotalAcrossSections(point.middle, cognitive),
          upper:
            point.sections &&
            Object.keys(point.sections).length === cognitive.length
              ? Object.fromEntries(
                  Object.entries(point.sections).map(([sectionId, section]) => [
                    sectionId,
                    section.upper,
                  ]),
                )
              : allocateTotalAcrossSections(point.upper, cognitive),
        }))
      : [];
    const allocatedHistory = canAllocate
      ? trajectoryHistory.map((point) => ({
          point,
          sections:
            point.sections && Object.keys(point.sections).length === 3
              ? Object.fromEntries(
                  Object.entries(point.sections).map(([sectionId, section]) => [
                    sectionId,
                    section.currentEstimate,
                  ]),
                )
              : allocateTotalAcrossSections(point.currentEstimate, cognitive),
        }))
      : [];
    const snapshots: ScoreProjectionSnapshot[] = allocatedHistory.map(
      ({ point, sections }) => ({
        modelVersion: preparation.versions.trajectoryModel,
        date: point.date,
        currentEstimate: point.currentEstimate,
        confidence: point.confidence ?? "low",
        uncertainty: point.uncertainty ?? 90,
        effectiveEvidenceWeight: point.effectiveEvidenceWeight ?? 0,
        sectionEstimates: sections,
      }),
    );

    const payload: ScoreProjectionResponse = {
      modelVersion: preparation.versions.trajectoryModel,
      generatedAt: preparation.generatedAt,
      horizons: [...HORIZONS],
      snapshots,
      sections: responseSections.map((section) => {
        const projection: ProjectionPoint[] =
          section.sectionNumber <= 3
            ? allocatedPoints.map((allocated) => ({
                day: allocated.point.day,
                date: allocated.point.date,
                pessimistic: allocated.lower[section.sectionId]!,
                realistic: allocated.middle[section.sectionId]!,
                optimistic: allocated.upper[section.sectionId]!,
              }))
            : [];
        const history: HistoricalProjectionPoint[] =
          section.sectionNumber <= 3
            ? allocatedHistory.map(({ point, sections }) => {
                const historicalSection = point.sections?.[section.sectionId];
                return {
                  date: point.date,
                  value: sections[section.sectionId]!,
                  confidence: historicalSection?.confidence ?? "low",
                  uncertainty: historicalSection?.uncertainty ?? 90,
                  effectiveEvidenceWeight:
                    historicalSection?.evidenceCount ?? 0,
                };
              })
            : [];
        return {
          sectionId: section.sectionId,
          sectionName:
            preparation.assessment.sections
              .find((candidate) => candidate.sectionId === section.sectionId)
              ?.sectionKey.replaceAll("_", " ") ??
            `Section ${section.sectionNumber}`,
          sectionNumber: section.sectionNumber,
          currentEstimate: section.currentEstimate,
          confidence: section.confidence ?? "low",
          uncertainty: section.uncertainty ?? 90,
          effectiveEvidenceWeight: section.evidenceCount,
          evidenceCount: section.evidenceCount,
          paceSource:
            trajectory.status === "available" &&
            (trajectory.recentCoreSectionEquivalentsPerWeekBySection[
              section.sectionId
            ] ?? 0) > 0
              ? ("recent_activity" as const)
              : ("default" as const),
          effectivePracticePerWeek:
            trajectory.status === "available"
              ? (trajectory.effectiveCoreSectionEquivalentsPerWeekBySection[
                  section.sectionId
                ] ?? 0)
              : 0,
          history,
          projection,
          horizons: HORIZONS.flatMap((day) => {
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
    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load Preparation.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
