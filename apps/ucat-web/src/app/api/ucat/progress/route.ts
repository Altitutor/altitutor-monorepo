import { NextResponse } from "next/server";
import {
  accumulateProgressAttempt,
  getOrCreateProgressBucket,
  progressPointsForQuestion,
  toProgressQuestionRef,
} from "@altitutor/shared";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { extractTextFromRichJson } from "@/features/question-engine/model/rich-text";
import type { JsonLike } from "@/features/question-engine/model/rich-text";
import type {
  SectionProgress,
  SetAttemptRow,
  MockAttemptRow,
  PracticeAttemptRow,
  QuestionAttemptRow,
  SectionCategoryProgress,
  ProgressResponse,
} from "@altitutor/shared";

export type {
  ProgressResponse,
  SectionProgress,
  SetAttemptRow,
  MockAttemptRow,
  PracticeAttemptRow,
  QuestionAttemptRow,
  SectionCategoryProgress,
} from "@altitutor/shared";

export async function GET(request: Request) {
  const sectionNumberParam = new URL(request.url).searchParams.get(
    "sectionNumber",
  );
  const sectionNumber =
    sectionNumberParam == null ? null : Number(sectionNumberParam);
  if (
    sectionNumberParam != null &&
    (!Number.isInteger(sectionNumber) ||
      sectionNumber! < 1 ||
      sectionNumber! > 4)
  ) {
    return NextResponse.json(
      { error: "Invalid section number" },
      { status: 400 },
    );
  }

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

  // ---------------------------------------------------------------------------
  // Wave 1: all queries here are independent and can run in parallel. They
  // collectively determine the IDs/sections needed by wave 2.
  // ---------------------------------------------------------------------------
  const questionAttemptsQuery = supabase
    .from("vstudent_ucat_my_question_attempts")
    .select(
      "id, question_id, question_stem_id, student_question_set_attempt_id, attempted_at, ucat_section_id, section_name, section_number, score, question_type, time_spent_seconds, student_question_speed, was_timed, question_stem_category_id, category_name",
    )
    .eq("is_submitted", true);
  const sectionsQuery = supabase
    .from("vstudent_ucat_sections")
    .select("id, name, section_number")
    .order("section_number");

  const [
    questionAttemptsRes,
    sectionsRes,
    setAttemptsRes,
    mockAttemptsRes,
    practiceAttemptsRes,
    totalPublicMocksRes,
    publicSetsRes,
  ] = await Promise.all([
    sectionNumber == null
      ? questionAttemptsQuery
      : questionAttemptsQuery.eq("section_number", sectionNumber),
    sectionNumber == null
      ? sectionsQuery
      : sectionsQuery.eq("section_number", sectionNumber),
    supabase
      .from("vstudent_ucat_my_set_attempts")
      .select(
        "id, attempted_at, completed_at, question_set_id, student_ucat_mock_attempt_id, score_points, total_points, scaled_score, time_taken_seconds, set_time_limit_seconds, student_set_speed, student_exam_speed, was_timed",
      )
      .not("completed_at", "is", null),
    supabase
      .from("vstudent_ucat_my_mock_attempts")
      .select("id, attempted_at, completed_at, ucat_mock_id")
      .not("completed_at", "is", null),
    (supabase as { from: (t: string) => ReturnType<typeof supabase.from> })
      .from("vstudent_ucat_my_practice_sessions")
      .select(
        "id, started_at, completed_at, ucat_section_id, section_name, score_points, total_points, question_count, unlimited",
      )
      .not("completed_at", "is", null),
    supabase
      .from("vstudent_ucat_mocks")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("vstudent_ucat_question_sets")
      .select("id, sections, is_student_generated, time_limit_seconds")
      .eq("is_student_generated", false),
  ]);

  const { data: questionAttemptsAll, error: qaError } = questionAttemptsRes;
  if (qaError) {
    return NextResponse.json({ error: qaError.message }, { status: 500 });
  }

  const { data: sections } = sectionsRes;
  const scopedSectionId =
    sectionNumber == null ? null : (sections?.[0]?.id ?? null);

  const { data: setAttemptsRaw, error: setError } = setAttemptsRes;
  if (setError) {
    return NextResponse.json({ error: setError.message }, { status: 500 });
  }

  const { data: mockAttemptsRaw, error: mockError } = mockAttemptsRes;
  if (mockError) {
    return NextResponse.json({ error: mockError.message }, { status: 500 });
  }

  const { data: practiceAttemptsRaw, error: practiceError } =
    practiceAttemptsRes;
  if (practiceError) {
    return NextResponse.json({ error: practiceError.message }, { status: 500 });
  }

  const { count: totalPublicMocks } = totalPublicMocksRes;
  const { data: publicSetsRaw } = publicSetsRes;

  // Dedupe by question_id: keep best attempt per question (highest score, then most recent)
  type QaRaw = (typeof questionAttemptsAll)[number];
  const bestByQuestion = new Map<string, QaRaw>();
  for (const qa of (questionAttemptsAll ?? []) as (QaRaw & {
    question_id?: string | null;
  })[]) {
    const qid = qa.question_id ?? qa.id;
    if (!qid) continue;
    const existing = bestByQuestion.get(qid);
    const score = qa.score ?? 0;
    const existingScore = existing?.score ?? 0;
    if (
      !existing ||
      score > existingScore ||
      (score === existingScore &&
        (qa.attempted_at ?? "") > (existing.attempted_at ?? ""))
    ) {
      bestByQuestion.set(qid, qa);
    }
  }
  const uniqueQuestionAttempts = [...bestByQuestion.values()];

  // Compute section progress: for syllogism max score = 2, else 1 (unique questions only)
  const sectionMap = new Map<
    string,
    {
      name: string;
      number: number;
      correct: number;
      max: number;
      syllogismStems: Set<string>;
    }
  >();
  for (const qa of uniqueQuestionAttempts) {
    const sectionId = qa.ucat_section_id;
    if (!sectionId) continue;
    const existing = sectionMap.get(sectionId);
    if (existing) {
      existing.correct += qa.score ?? 0;
      existing.max += progressPointsForQuestion(
        toProgressQuestionRef({
          questionId: qa.question_id ?? qa.id ?? "",
          questionStemId: qa.question_stem_id,
          questionType: qa.question_type,
        }),
        existing.syllogismStems,
      );
    } else {
      const syllogismStems = new Set<string>();
      sectionMap.set(sectionId, {
        name: qa.section_name ?? "Unknown",
        number: qa.section_number ?? 0,
        correct: qa.score ?? 0,
        max: progressPointsForQuestion(
          toProgressQuestionRef({
            questionId: qa.question_id ?? qa.id ?? "",
            questionStemId: qa.question_stem_id,
            questionType: qa.question_type,
          }),
          syllogismStems,
        ),
        syllogismStems,
      });
    }
  }

  let sectionProgress: SectionProgress[] = Array.from(sectionMap.entries())
    .map(([sectionId, data]) => ({
      sectionId,
      sectionName: data.name,
      sectionNumber: data.number,
      correctScore: data.correct,
      maxScore: data.max,
      percentage:
        data.max > 0 ? Math.round((data.correct / data.max) * 100) : 0,
    }))
    .sort((a, b) => a.sectionNumber - b.sectionNumber);

  // Ensure all 4 sections are present (from ucat_sections; fetched in wave 1)
  const sectionIds = new Set(sectionProgress.map((s) => s.sectionId));
  for (const sec of sections ?? []) {
    const secId = sec.id;
    if (!secId || sectionIds.has(secId)) continue;
    sectionProgress.push({
      sectionId: secId,
      sectionName: sec.name ?? "Unknown",
      sectionNumber: sec.section_number ?? 0,
      correctScore: 0,
      maxScore: 0,
      percentage: 0,
    });
  }
  sectionProgress.sort((a, b) => a.sectionNumber - b.sectionNumber);

  // setAttemptsRaw was fetched in wave 1 (above). View uses SELECT sqsa.* so
  // extra columns exist at runtime; generated types may be outdated.
  type SetAttemptRaw = {
    id: string | null;
    attempted_at: string | null;
    completed_at: string | null;
    question_set_id: string | null;
    student_ucat_mock_attempt_id: string | null;
    score_points: number | null;
    total_points: number | null;
    scaled_score: number | null;
    time_taken_seconds: number | null;
    set_time_limit_seconds?: number | null;
    student_set_speed?: number | null;
    student_exam_speed?: number | null;
    was_timed?: boolean;
  };

  // ---------------------------------------------------------------------------
  // Wave 2: queries that need IDs/sections produced by wave 1 — fan out in
  // parallel:
  //   * setDetails       (depends on setIds from setAttemptsRaw)
  //   * mockDetails      (depends on mockIds from mockAttemptsRaw)
  //   * publicCountsRaw  (depends on section IDs from sectionProgress)
  //   * categoriesData   (depends on section IDs from sectionProgress)
  // ---------------------------------------------------------------------------
  const setIds = [
    ...new Set(
      (setAttemptsRaw ?? [])
        .map((r) => (r as SetAttemptRaw).question_set_id)
        .filter(Boolean),
    ),
  ];
  const mockIds = [
    ...new Set(
      (mockAttemptsRaw ?? [])
        .map((r) => (r as { ucat_mock_id?: string | null }).ucat_mock_id)
        .filter(Boolean),
    ),
  ] as string[];
  const sectionIdsForCounts = sectionProgress.map((s) => s.sectionId);

  type PublicCountRow = {
    section_id: string;
    question_stem_category_id: string | null;
    total_questions: number;
  };

  const [setDetailsRes, mockDetailsRes, publicCountsRes, categoriesRes] =
    await Promise.all([
      setIds.length > 0
        ? supabase
            .from("vstudent_ucat_question_sets")
            .select(
              "id, name, time_limit_seconds, time_limit_at_exam_speed_seconds, sections, is_student_generated",
            )
            .in("id", setIds)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
      mockIds.length > 0
        ? supabase
            .from("vstudent_ucat_mocks")
            .select("id, name")
            .in("id", mockIds)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
      sectionIdsForCounts.length > 0
        ? (
            supabase as unknown as {
              from: (r: string) => {
                select: (c: string) => {
                  in: (
                    col: string,
                    vals: string[],
                  ) => Promise<{ data: PublicCountRow[] | null }>;
                };
              };
            }
          )
            .from("vstudent_ucat_public_question_counts")
            .select("section_id, question_stem_category_id, total_questions")
            .in("section_id", sectionIdsForCounts)
        : Promise.resolve({ data: [] as PublicCountRow[] | null }),
      sectionIdsForCounts.length > 0
        ? supabase
            .from("vstudent_ucat_question_stem_categories")
            .select("id, name, ucat_section_id")
            .in("ucat_section_id", sectionIdsForCounts)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    ]);

  const { data: setDetails } = setDetailsRes as {
    data: Array<{
      id: string;
      name: unknown;
      time_limit_seconds: number | null;
      time_limit_at_exam_speed_seconds: number | null;
      sections: unknown;
      is_student_generated: boolean | null;
    }> | null;
  };

  const timeLimitBySetId = new Map(
    (setDetails ?? []).map((s) => [
      s.id,
      {
        timeLimit: s.time_limit_seconds,
        timeLimitExam: s.time_limit_at_exam_speed_seconds,
        name: s.name,
        sections: s.sections as Array<{ section_number?: number }> | null,
        isStudentGenerated: s.is_student_generated ?? false,
      },
    ]),
  );

  const sectionByNumber = new Map(
    sectionProgress.map((s) => [s.sectionNumber, s.sectionId]),
  );

  const setAttempts: SetAttemptRow[] = (
    (setAttemptsRaw ?? []) as SetAttemptRaw[]
  ).map((row) => {
    const timeTaken = row.time_taken_seconds ?? null;
    let setTimeLimit = row.set_time_limit_seconds ?? null;
    let timeLimitExam: number | null = null;

    if (!setTimeLimit && row.question_set_id) {
      const details = timeLimitBySetId.get(row.question_set_id);
      setTimeLimit = details?.timeLimit ?? null;
      timeLimitExam = details?.timeLimitExam ?? null;
    } else if (row.question_set_id) {
      const details = timeLimitBySetId.get(row.question_set_id);
      timeLimitExam = details?.timeLimitExam ?? null;
    }

    // Compute speeds when null (fallback for older attempts or when trigger didn't run)
    let studentSetSpeed = row.student_set_speed ?? null;
    let studentExamSpeed = row.student_exam_speed ?? null;
    if (timeTaken != null && timeTaken > 0) {
      if (studentSetSpeed == null && setTimeLimit != null && setTimeLimit > 0) {
        studentSetSpeed = setTimeLimit / timeTaken;
      }
      if (
        studentExamSpeed == null &&
        timeLimitExam != null &&
        timeLimitExam > 0
      ) {
        studentExamSpeed = timeLimitExam / timeTaken;
      }
    }

    const details = row.question_set_id
      ? timeLimitBySetId.get(row.question_set_id)
      : undefined;
    const questionSetName =
      details?.name != null
        ? extractTextFromRichJson(details.name as JsonLike) || null
        : null;

    const sectionsArr = details?.sections;
    const firstSectionNum =
      Array.isArray(sectionsArr) && sectionsArr.length > 0
        ? sectionsArr[0]?.section_number
        : undefined;
    const sectionId =
      firstSectionNum != null
        ? (sectionByNumber.get(firstSectionNum) ?? null)
        : null;

    return {
      id: row.id ?? "",
      attemptedAt: row.attempted_at ?? "",
      completedAt: row.completed_at,
      questionSetId: row.question_set_id ?? "",
      questionSetName: questionSetName || null,
      isStudentGenerated: details?.isStudentGenerated ?? false,
      studentUcatMockAttemptId: row.student_ucat_mock_attempt_id,
      scorePoints: row.score_points,
      totalPoints: row.total_points,
      scaledScore: row.scaled_score,
      timeTakenSeconds: timeTaken,
      setTimeLimitSeconds: setTimeLimit,
      studentSetSpeed,
      studentExamSpeed,
      wasTimed: row.was_timed ?? false,
      sectionId,
    };
  });

  // publicCountsRaw fetched in wave 2. View added in migration 20260316190000.
  const { data: publicCountsRaw } = publicCountsRes as {
    data: PublicCountRow[] | null;
  };
  const publicCounts = publicCountsRaw ?? [];
  const sectionTotalPublic = new Map<string, number>();
  const categoryTotalPublic = new Map<string, number>();
  for (const row of publicCounts) {
    const sectionId = row.section_id;
    if (!sectionId) continue;
    const catId = row.question_stem_category_id ?? "__uncategorized__";
    const total = row.total_questions ?? 0;
    sectionTotalPublic.set(
      sectionId,
      (sectionTotalPublic.get(sectionId) ?? 0) + total,
    );
    categoryTotalPublic.set(`${sectionId}:${catId}`, total);
  }
  sectionProgress = sectionProgress.map((s) => ({
    ...s,
    totalPublicQuestions: sectionTotalPublic.get(s.sectionId),
  }));

  // Compute raw per-section, per-category correctness stats.
  const sectionCategorySums = new Map<
    string,
    { correct: number; max: number; syllogismStems: Set<string> }
  >();
  type QaWithCategory = (typeof questionAttemptsAll)[number] & {
    question_stem_id?: string | null;
    question_stem_category_id?: string | null;
    category_name?: string | null;
  };
  for (const qa of uniqueQuestionAttempts as QaWithCategory[]) {
    const sectionId = qa.ucat_section_id;
    if (!sectionId) continue;
    const categoryId = qa.question_stem_category_id ?? "__uncategorized__";
    const sumKey = `${sectionId}:${categoryId}`;
    accumulateProgressAttempt(
      getOrCreateProgressBucket(sectionCategorySums, sumKey),
      {
        questionId: qa.question_id ?? qa.id ?? "",
        questionStemId: qa.question_stem_id,
        questionType: qa.question_type,
        score: qa.score,
      },
    );
  }
  // categoriesData fetched in wave 2
  const { data: categoriesData } = categoriesRes as {
    data: Array<{
      id: string | null;
      name: string | null;
      ucat_section_id: string | null;
    }> | null;
  };

  const categoriesBySection = new Map<string, { id: string; name: string }[]>();
  for (const c of categoriesData ?? []) {
    const sid = c.ucat_section_id;
    const catId = c.id;
    if (!sid || !catId) continue;
    const list = categoriesBySection.get(sid) ?? [];
    list.push({ id: catId, name: c.name ?? "Unknown" });
    categoriesBySection.set(sid, list);
  }

  const sectionCategoryProgress: Record<string, SectionCategoryProgress[]> = {};
  for (const s of sectionProgress) {
    const cats = categoriesBySection.get(s.sectionId) ?? [];
    const result: SectionCategoryProgress[] = [];
    for (const cat of cats) {
      const sumKey = `${s.sectionId}:${cat.id}`;
      const { correct, max } = sectionCategorySums.get(sumKey) ?? {
        correct: 0,
        max: 0,
      };
      result.push({
        categoryId: cat.id,
        categoryName: cat.name,
        correctScore: correct,
        maxScore: max,
        percentage: max > 0 ? Math.round((correct / max) * 100) : 0,
        totalPublicQuestions: categoryTotalPublic.get(sumKey),
      });
    }
    const uncatSum = sectionCategorySums.get(
      `${s.sectionId}:__uncategorized__`,
    );
    if (uncatSum && uncatSum.max > 0) {
      result.push({
        categoryId: "__uncategorized__",
        categoryName: "Uncategorized",
        correctScore: uncatSum.correct,
        maxScore: uncatSum.max,
        percentage: Math.round((uncatSum.correct / uncatSum.max) * 100),
        totalPublicQuestions: categoryTotalPublic.get(
          `${s.sectionId}:__uncategorized__`,
        ),
      });
    }
    sectionCategoryProgress[s.sectionId] = result.sort((a, b) =>
      a.categoryName.localeCompare(b.categoryName),
    );
  }

  // mockAttemptsRaw fetched in wave 1; mockDetails fetched in wave 2.
  // Note: vstudent_ucat_my_mock_attempts view types may be outdated; score
  // columns from table.
  const { data: mockDetails } = mockDetailsRes as {
    data: Array<{ id: string | null; name: unknown }> | null;
  };
  const mockNameById = new Map(
    (mockDetails ?? []).map((m) => [
      m.id,
      m.name != null
        ? extractTextFromRichJson(m.name as JsonLike) || null
        : null,
    ]),
  );

  type MockAttemptRaw = (typeof mockAttemptsRaw)[number];

  // Section 4 (Situational Judgement) excluded from mock score
  const section4Id =
    sectionProgress.find((s) => s.sectionNumber === 4)?.sectionId ?? null;
  const SCALED_MAX_PER_SECTION = 900;

  // Enrich mock attempts with aggregated timing and scores from child set attempts
  const mockAttempts: MockAttemptRow[] = [];
  for (const m of mockAttemptsRaw ?? []) {
    const row = m as MockAttemptRaw;
    const childSets = setAttempts.filter(
      (s) => s.studentUcatMockAttemptId === row.id,
    );
    const scoredChildSets = childSets.filter(
      (s) => s.sectionId != null && s.sectionId !== section4Id,
    );
    const timeTakenSeconds = childSets.reduce(
      (sum, s) => sum + (s.timeTakenSeconds ?? 0),
      0,
    );
    const setTimeLimitSeconds = childSets.reduce(
      (sum, s) => sum + (s.setTimeLimitSeconds ?? 0),
      0,
    );
    const scorePoints = scoredChildSets.reduce(
      (sum, s) => sum + (s.scorePoints ?? 0),
      0,
    );
    const totalPoints = scoredChildSets.reduce(
      (sum, s) => sum + (s.totalPoints ?? 0),
      0,
    );
    const scaledScore = scoredChildSets.reduce(
      (sum, s) => sum + (s.scaledScore ?? 0),
      0,
    );
    const speeds = childSets.filter(
      (s) => s.studentSetSpeed != null || s.studentExamSpeed != null,
    );
    const studentSetSpeed =
      speeds.length > 0
        ? speeds.reduce((sum, s) => sum + (s.studentSetSpeed ?? 0), 0) /
          speeds.length
        : null;
    const studentExamSpeed =
      speeds.length > 0
        ? speeds.reduce((sum, s) => sum + (s.studentExamSpeed ?? 0), 0) /
          speeds.length
        : null;

    const wasTimed = childSets.length > 0 && childSets.every((s) => s.wasTimed);

    const scaledScoreMax =
      scoredChildSets.length > 0
        ? scoredChildSets.length * SCALED_MAX_PER_SECTION
        : null;

    mockAttempts.push({
      id: row.id ?? "",
      attemptedAt: row.attempted_at ?? "",
      completedAt: row.completed_at,
      ucatMockId: row.ucat_mock_id ?? "",
      mockName: row.ucat_mock_id
        ? (mockNameById.get(row.ucat_mock_id) ?? null)
        : null,
      scorePoints: totalPoints > 0 ? scorePoints : null,
      totalPoints: totalPoints > 0 ? totalPoints : null,
      scaledScore: totalPoints > 0 ? scaledScore : null,
      scaledScoreMax,
      timeTakenSeconds: setTimeLimitSeconds > 0 ? timeTakenSeconds : null,
      setTimeLimitSeconds: setTimeLimitSeconds > 0 ? setTimeLimitSeconds : null,
      studentSetSpeed,
      studentExamSpeed,
      wasTimed,
    });
  }

  // practiceAttemptsRaw fetched in wave 1.
  type PracticeRaw = {
    id?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    ucat_section_id?: string | null;
    section_name?: string | null;
    score_points?: number | null;
    total_points?: number | null;
    question_count?: number | null;
    unlimited?: boolean | null;
  };
  const practiceAttempts: PracticeAttemptRow[] = (
    (practiceAttemptsRaw ?? []) as PracticeRaw[]
  ).map((row) => {
    const attemptedAt = row.started_at ?? "";
    const completedAt = row.completed_at ?? null;
    let timeTakenSeconds: number | null = null;
    if (attemptedAt && completedAt) {
      const elapsedMs =
        new Date(completedAt).getTime() - new Date(attemptedAt).getTime();
      if (Number.isFinite(elapsedMs) && elapsedMs > 0) {
        timeTakenSeconds = Math.round(elapsedMs / 1000);
      }
    }
    return {
      id: row.id ?? "",
      attemptedAt,
      completedAt,
      ucatSectionId: row.ucat_section_id ?? "",
      sectionName: row.section_name ?? "Unknown",
      scorePoints: row.score_points ?? null,
      totalPoints: row.total_points ?? null,
      questionCount: row.question_count ?? null,
      timeTakenSeconds,
      unlimited: row.unlimited ?? false,
    };
  });

  type QuestionAttemptRaw = {
    id: string | null;
    question_id: string | null;
    question_stem_id: string | null;
    student_question_set_attempt_id: string | null;
    attempted_at: string | null;
    score: number | null;
    question_type: string | null;
    time_spent_seconds: number | null;
    student_question_speed: number | null;
    was_timed: boolean | null;
    ucat_section_id: string | null;
    section_name: string | null;
    section_number: number | null;
    question_stem_category_id: string | null;
    category_name: string | null;
  };

  const questionAttempts: QuestionAttemptRow[] = (
    questionAttemptsAll ?? []
  ).map((r: QuestionAttemptRaw) => ({
    id: r.id ?? "",
    questionId: r.question_id ?? r.id ?? "",
    questionStemId: r.question_stem_id ?? null,
    studentQuestionSetAttemptId: r.student_question_set_attempt_id ?? null,
    attemptedAt: r.attempted_at ?? "",
    score: r.score,
    questionType: r.question_type,
    timeSpentSeconds: r.time_spent_seconds,
    studentQuestionSpeed: r.student_question_speed,
    wasTimed: r.was_timed ?? false,
    ucatSectionId: r.ucat_section_id,
    sectionName: r.section_name,
    sectionNumber: r.section_number ?? null,
    questionStemCategoryId: r.question_stem_category_id,
    categoryName: r.category_name,
  }));

  // totalPublicMocks count and publicSetsRaw both fetched in wave 1.
  const totalPublicSetsBySection: Record<string, number> = {};
  const totalPublicUntimedSetsBySection: Record<string, number> = {};
  const totalPublicTimedSetsBySection: Record<string, number> = {};
  for (const s of sectionProgress) {
    totalPublicSetsBySection[s.sectionId] = 0;
    totalPublicUntimedSetsBySection[s.sectionId] = 0;
    totalPublicTimedSetsBySection[s.sectionId] = 0;
  }
  const sectionByNumberForSets = new Map(
    sectionProgress.map((s) => [s.sectionNumber, s.sectionId]),
  );
  for (const row of publicSetsRaw ?? []) {
    if (row.is_student_generated) continue;
    const sectionsArr = row.sections as Array<{
      section_number?: number;
    }> | null;
    const firstSectionNum =
      Array.isArray(sectionsArr) && sectionsArr.length > 0
        ? sectionsArr[0]?.section_number
        : undefined;
    const sectionId =
      firstSectionNum != null
        ? sectionByNumberForSets.get(firstSectionNum)
        : undefined;
    if (sectionId) {
      totalPublicSetsBySection[sectionId] =
        (totalPublicSetsBySection[sectionId] ?? 0) + 1;
      const isTimed =
        row.time_limit_seconds != null && row.time_limit_seconds > 0;
      if (isTimed) {
        totalPublicTimedSetsBySection[sectionId] =
          (totalPublicTimedSetsBySection[sectionId] ?? 0) + 1;
      } else {
        totalPublicUntimedSetsBySection[sectionId] =
          (totalPublicUntimedSetsBySection[sectionId] ?? 0) + 1;
      }
    }
  }

  const responseSetAttempts =
    sectionNumber == null
      ? setAttempts
      : scopedSectionId == null
        ? []
        : setAttempts.filter(
            (attempt) => attempt.sectionId === scopedSectionId,
          );
  const responsePracticeAttempts =
    sectionNumber == null
      ? practiceAttempts
      : scopedSectionId == null
        ? []
        : practiceAttempts.filter(
            (attempt) => attempt.ucatSectionId === scopedSectionId,
          );
  const scopedMockAttemptIds = new Set(
    responseSetAttempts
      .map((attempt) => attempt.studentUcatMockAttemptId)
      .filter((id): id is string => id != null),
  );
  const responseMockAttempts =
    sectionNumber == null
      ? mockAttempts
      : mockAttempts.filter((attempt) => scopedMockAttemptIds.has(attempt.id));

  return NextResponse.json({
    sectionProgress,
    setAttempts: responseSetAttempts,
    mockAttempts: responseMockAttempts,
    practiceAttempts: responsePracticeAttempts,
    questionAttempts,
    sectionCategoryProgress,
    totalPublicMocks: totalPublicMocks ?? 0,
    totalPublicSetsBySection,
    totalPublicUntimedSetsBySection,
    totalPublicTimedSetsBySection,
  } satisfies ProgressResponse);
}
