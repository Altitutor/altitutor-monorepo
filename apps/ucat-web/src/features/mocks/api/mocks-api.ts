import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { SECTION_NUMBER_TO_NAME } from "@/features/sets/lib/section-labels";
import {
  extractTextFromRichJson,
  type JsonLike,
} from "@/features/question-engine/model/rich-text";

export type MockAttemptSectionScore = {
  sectionName: string;
  sectionNumber: number;
  scorePoints: number | null;
  totalPoints: number | null;
};

export type MockAttemptWithBreakdown = {
  id: string;
  attemptedAt: string;
  completedAt: string | null;
  scorePoints: number | null;
  totalPoints: number | null;
  scaledScore: number | null;
  /** Max possible scaled score (900 × section 1–3 sets). Section 4 excluded. */
  scaledScoreMax: number | null;
  sectionScores: MockAttemptSectionScore[];
};

export async function getMockAttemptsWithBreakdown(
  mockId: string,
): Promise<MockAttemptWithBreakdown[]> {
  const supabase = getSupabaseBrowserClient();

  const { data: mockAttemptsRaw, error: mockErr } = await supabase
    .from("vstudent_ucat_my_mock_attempts")
    .select("id, attempted_at, completed_at")
    .eq("ucat_mock_id", mockId)
    .not("completed_at", "is", null)
    .order("attempted_at", { ascending: false });

  if (mockErr)
    throw new Error(mockErr.message ?? "Failed to load mock attempts");
  if (!mockAttemptsRaw || mockAttemptsRaw.length === 0) return [];

  const mockAttemptIds = mockAttemptsRaw
    .map((r) => r.id)
    .filter(Boolean) as string[];

  const { data: mockDetail } = await supabase
    .from("vstudent_ucat_mock_detail")
    .select("sets")
    .eq("id", mockId)
    .single();

  const sets = (mockDetail?.sets as Array<{ id: string }> | null) ?? [];
  const setIdsInOrder = sets.map((s) => s.id).filter(Boolean);

  const { data: setDetails } =
    setIdsInOrder.length > 0
      ? await supabase
          .from("vstudent_ucat_question_sets")
          .select("id, sections")
          .in("id", setIdsInOrder)
      : { data: [] };

  const sectionsBySetId = new Map<
    string,
    { sectionNumber: number; sectionName: string }
  >();
  for (const s of setDetails ?? []) {
    const sections =
      (s.sections as Array<{
        section_number?: number;
        name?: string;
      }> | null) ?? [];
    const first = sections[0];
    const sectionNumber = first?.section_number ?? 1;
    const sectionName =
      first?.name ??
      SECTION_NUMBER_TO_NAME[sectionNumber] ??
      `Section ${sectionNumber}`;
    if (s.id) sectionsBySetId.set(s.id, { sectionNumber, sectionName });
  }

  const { data: setAttemptsRaw, error: setErr } = await supabase
    .from("vstudent_ucat_my_set_attempts")
    .select(
      "id, student_ucat_mock_attempt_id, question_set_id, score_points, total_points, scaled_score",
    )
    .in("student_ucat_mock_attempt_id", mockAttemptIds)
    .not("completed_at", "is", null);

  if (setErr) throw new Error(setErr.message ?? "Failed to load set attempts");

  const setAttemptsByMockAttempt = new Map<
    string,
    Array<{
      questionSetId: string;
      scorePoints: number | null;
      totalPoints: number | null;
      scaledScore: number | null;
    }>
  >();
  for (const row of setAttemptsRaw ?? []) {
    const mockAttemptId = row.student_ucat_mock_attempt_id;
    if (!mockAttemptId) continue;
    const list = setAttemptsByMockAttempt.get(mockAttemptId) ?? [];
    list.push({
      questionSetId: row.question_set_id ?? "",
      scorePoints: row.score_points,
      totalPoints: row.total_points,
      scaledScore: row.scaled_score,
    });
    setAttemptsByMockAttempt.set(mockAttemptId, list);
  }

  const SITUATIONAL_JUDGEMENT_SECTION = 4;

  const result: MockAttemptWithBreakdown[] = [];
  for (const ma of mockAttemptsRaw) {
    const childSetAttempts = setAttemptsByMockAttempt.get(ma.id ?? "") ?? [];
    const childBySetId = new Map(
      childSetAttempts.map((c) => [c.questionSetId, c]),
    );

    const sectionScores: MockAttemptSectionScore[] = setIdsInOrder.map(
      (setId) => {
        const sec = sectionsBySetId.get(setId) ?? {
          sectionNumber: 0,
          sectionName: "Unknown",
        };
        const attempt = childBySetId.get(setId);
        return {
          sectionName: sec.sectionName,
          sectionNumber: sec.sectionNumber,
          scorePoints: attempt?.scorePoints ?? null,
          totalPoints: attempt?.totalPoints ?? null,
        };
      },
    );

    // Exclude Section 4 (Situational Judgement) from mock score
    const scoredChildSetAttempts = childSetAttempts.filter((c) => {
      const sec = sectionsBySetId.get(c.questionSetId);
      return sec?.sectionNumber !== SITUATIONAL_JUDGEMENT_SECTION;
    });

    const scorePoints = scoredChildSetAttempts.reduce(
      (sum, c) => sum + (c.scorePoints ?? 0),
      0,
    );
    const totalPoints = scoredChildSetAttempts.reduce(
      (sum, c) => sum + (c.totalPoints ?? 0),
      0,
    );
    const scaledScore = scoredChildSetAttempts.reduce(
      (sum, c) => sum + (c.scaledScore ?? 0),
      0,
    );
    const scaledScoreMax =
      scoredChildSetAttempts.length > 0
        ? scoredChildSetAttempts.length * 900
        : null;

    result.push({
      id: ma.id ?? "",
      attemptedAt: ma.attempted_at ?? "",
      completedAt: ma.completed_at,
      scorePoints: totalPoints > 0 ? scorePoints : null,
      totalPoints: totalPoints > 0 ? totalPoints : null,
      scaledScore: totalPoints > 0 ? scaledScore : null,
      scaledScoreMax,
      sectionScores,
    });
  }

  return result;
}

export async function getAttemptedMockIds(): Promise<Set<string>> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("vstudent_ucat_my_mock_attempts")
    .select("ucat_mock_id")
    .not("completed_at", "is", null);
  if (error) throw new Error(error.message ?? "Failed to load attempted mocks");
  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.ucat_mock_id) ids.add(row.ucat_mock_id);
  }
  return ids;
}

export type MockSetTiming = {
  id: string;
  name: string;
  compactName: string;
  timeLimitSeconds: number | null;
};

export type StudentMockRow = {
  id: string;
  name: string | null;
  display_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  set_count: number | null;
  has_timed_sets: boolean | null;
  catalog_index: number | null;
  /** Ordered sets in the mock with time limits (from mock detail). */
  setTimings: MockSetTiming[];
  /** Sum of timed set limits; null when no timed sets. */
  totalTimeLimitSeconds: number | null;
};

export type MocksFilters = {
  search?: string;
  timed?: "timed" | "untimed" | "all";
  source?: "my" | "public" | "all";
};

type MockListRow = {
  id: string;
  name: string | null;
  display_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  set_count: number | null;
  has_timed_sets: boolean | null;
  catalog_index: number | null;
};

type MockDetailSetJson = {
  id?: string;
  name?: unknown;
  display_name?: string | null;
  compact_display_name?: string | null;
  time_limit_seconds?: number | null;
};

function parseMockSetTimings(sets: unknown): MockSetTiming[] {
  if (!Array.isArray(sets)) return [];
  return (sets as MockDetailSetJson[])
    .filter((set): set is MockDetailSetJson & { id: string } => Boolean(set?.id))
    .map((set) => ({
      id: set.id,
      name: set.display_name || extractTextFromRichJson(set.name as JsonLike) || "Set",
      compactName: set.compact_display_name || set.display_name || extractTextFromRichJson(set.name as JsonLike) || "Set",
      timeLimitSeconds: set.time_limit_seconds ?? null,
    }));
}

function totalTimedSeconds(setTimings: MockSetTiming[]): number | null {
  const timed = setTimings
    .map((set) => set.timeLimitSeconds)
    .filter((seconds): seconds is number => seconds != null && seconds > 0);
  if (timed.length === 0) return null;
  return timed.reduce((sum, seconds) => sum + seconds, 0);
}

export async function getStudentMocks(): Promise<StudentMockRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("vstudent_ucat_mocks")
    .select(
      "id,name,display_name,created_at,updated_at,created_by,set_count,has_timed_sets,catalog_index",
    )
    .order("catalog_index");
  if (error) throw new Error(error.message ?? "Failed to load mocks");

  const mocks = (data ?? []) as MockListRow[];
  if (mocks.length === 0) return [];

  const { data: details, error: detailError } = await supabase
    .from("vstudent_ucat_mock_detail")
    .select("id, sets")
    .in(
      "id",
      mocks.map((mock) => mock.id),
    );
  if (detailError) {
    throw new Error(detailError.message ?? "Failed to load mock set timings");
  }

  const timingsByMockId = new Map<string, MockSetTiming[]>();
  for (const detail of details ?? []) {
    if (!detail.id) continue;
    timingsByMockId.set(detail.id, parseMockSetTimings(detail.sets));
  }

  return mocks.map((mock) => {
    const setTimings = timingsByMockId.get(mock.id) ?? [];
    return {
      ...mock,
      setTimings,
      totalTimeLimitSeconds: totalTimedSeconds(setTimings),
    };
  });
}

type SetDetailStemMeta = {
  questions_meta?: Array<unknown> | null;
};

function countQuestionsFromStems(stems: unknown): number {
  if (!Array.isArray(stems)) return 0;
  return stems.reduce<number>((sum, stem) => {
    const meta = (stem as SetDetailStemMeta).questions_meta;
    return sum + (Array.isArray(meta) ? meta.length : 0);
  }, 0);
}

/** Total question count across all sets in a mock. */
export async function getMockQuestionCount(mockId: string): Promise<number> {
  const supabase = getSupabaseBrowserClient();
  const { data: mockDetail, error: mockError } = await supabase
    .from("vstudent_ucat_mock_detail")
    .select("sets")
    .eq("id", mockId)
    .maybeSingle();
  if (mockError) {
    throw new Error(mockError.message ?? "Failed to load mock detail");
  }

  const setIds =
    (
      (mockDetail?.sets as Array<{ id?: string } | null> | null) ?? []
    )
      .map((set) => set?.id)
      .filter((id): id is string => Boolean(id));

  if (setIds.length === 0) return 0;

  const { data: setDetails, error: setsError } = await supabase
    .from("vstudent_ucat_question_set_detail")
    .select("stems")
    .in("id", setIds);
  if (setsError) {
    throw new Error(setsError.message ?? "Failed to load mock question count");
  }

  const rows = (setDetails ?? []) as Array<{ stems: unknown }>;
  return rows.reduce<number>(
    (sum, set) => sum + countQuestionsFromStems(set.stems),
    0,
  );
}

export function compareStudentMocksByCatalog(
  left: StudentMockRow,
  right: StudentMockRow,
): number {
  const leftIndex = left.catalog_index;
  const rightIndex = right.catalog_index;
  if (leftIndex == null && rightIndex == null) return 0;
  if (leftIndex == null) return 1;
  if (rightIndex == null) return -1;
  return leftIndex - rightIndex;
}

export function filterMocks(
  mocks: StudentMockRow[],
  filters: MocksFilters,
): StudentMockRow[] {
  return mocks.filter((mock) => {
    if (filters.search?.trim()) {
      const searchLower = filters.search.trim().toLowerCase();
      const nameText = (mock.display_name ?? mock.name ?? "").toLowerCase();
      if (!nameText.includes(searchLower)) return false;
    }
    if (filters.timed === "timed" && !mock.has_timed_sets) {
      return false;
    }
    if (filters.timed === "untimed" && mock.has_timed_sets) {
      return false;
    }
    if (filters.source === "my") {
      return false;
    }
    return true;
  });
}
