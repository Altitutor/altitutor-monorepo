import type { Json } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuestionEngineExam } from "@/features/question-engine/model/types";
import { catchUpExpiredSegments } from "@/lib/ucat/exam-attempt/segment-catch-up";
import {
  resolveExamForCatchUp,
  toStoredExamTiming,
} from "@/lib/ucat/exam-attempt/load-exam-for-catch-up";
import {
  finalizeExamAttemptOnServer,
  isExamAttemptAtResults,
} from "@/lib/ucat/exam-attempt/finalize-attempt";
import { computeSegmentEndsAt } from "@/lib/ucat/exam-attempt/timing";
import { mergeQuestionAttemptRowsIntoState } from "@/lib/ucat/exam-attempt/resume-state";
import type {
  ActiveExamAttempt,
  BeginExamAttemptInput,
  ExamAttemptKind,
  ExamEngineSnapshot,
  QuestionActiveTimingContext,
  QuestionActiveTimingState,
  SyncExamAttemptInput,
} from "@/lib/ucat/exam-attempt/types";
import { checkQuotaForAction } from "@/lib/ucat/quota/quota-service";

type AdminClient = SupabaseClient;

export type StoredExamTiming = {
  setModeTiming?: QuestionEngineExam["setModeTiming"];
  mockTimingSegments?: QuestionEngineExam["mockTimingSegments"];
  mockSetSummaries?: QuestionEngineExam["mockSetSummaries"];
  timePerQuestionSeconds?: number | null;
};

export type StoredExamSnapshot = {
  v: 1;
  state: ExamEngineSnapshot;
  exam: {
    sourceType: QuestionEngineExam["sourceType"];
    sourceId: string;
    practice: boolean;
  };
  examTiming?: StoredExamTiming;
  setAttemptIdsBySetId: Record<string, string>;
  mockAttemptId: string | null;
};

type AttemptRowBase = {
  id: string;
  engine_snapshot: Json | null;
  current_segment_ends_at: string | null;
  completed_at: string | null;
};

type PersistedAttemptSnapshot = {
  inProgress: boolean;
  stored: StoredExamSnapshot | null;
  currentSegmentEndsAt: string | null;
};

export function wrapStoredSnapshot(input: {
  state: ExamEngineSnapshot;
  exam: StoredExamSnapshot["exam"];
  examTiming?: StoredExamTiming;
  setAttemptIdsBySetId: Record<string, string>;
  mockAttemptId: string | null;
}): StoredExamSnapshot {
  return {
    v: 1,
    state: input.state,
    exam: input.exam,
    examTiming: input.examTiming,
    setAttemptIdsBySetId: input.setAttemptIdsBySetId,
    mockAttemptId: input.mockAttemptId,
  };
}

export function parseStoredSnapshot(
  value: Json | null,
): StoredExamSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Partial<StoredExamSnapshot>;
  if (obj.v !== 1 || !obj.state || !obj.exam) return null;
  return {
    v: 1,
    state: obj.state,
    exam: obj.exam,
    examTiming: obj.examTiming,
    setAttemptIdsBySetId: obj.setAttemptIdsBySetId ?? {},
    mockAttemptId: obj.mockAttemptId ?? null,
  };
}

function enrichStoredSnapshotForAttempt(
  kind: ExamAttemptKind,
  attemptId: string,
  resourceId: string,
  stored: StoredExamSnapshot,
): StoredExamSnapshot {
  if (kind === "set") {
    return {
      ...stored,
      setAttemptIdsBySetId: {
        ...stored.setAttemptIdsBySetId,
        [resourceId]: stored.setAttemptIdsBySetId[resourceId] ?? attemptId,
      },
    };
  }
  if (kind === "mock") {
    return {
      ...stored,
      mockAttemptId: stored.mockAttemptId ?? attemptId,
    };
  }
  return stored;
}

async function reconcileSetSnapshotFromQuestionAttempts(
  admin: AdminClient,
  studentId: string,
  attemptId: string,
  questionSetId: string,
  stored: StoredExamSnapshot,
): Promise<StoredExamSnapshot> {
  const [attemptsResult, stemsResult] = await Promise.all([
    admin
      .from("student_question_attempts")
      .select(
        "question_id, question_answer_option_id, answer_snapshot, is_flagged",
      )
      .eq("student_id", studentId)
      .eq("student_question_set_attempt_id", attemptId),
    admin
      .from("question_stems_question_sets")
      .select("question_stem_id")
      .eq("question_set_id", questionSetId)
      .order("index"),
  ]);

  if (attemptsResult.error || !attemptsResult.data?.length) return stored;

  const orderedStemIds = (stemsResult.data ?? []).map(
    (row) => row.question_stem_id,
  );
  let questionIdsInOrder: string[] = [];
  if (!stemsResult.error && orderedStemIds.length > 0) {
    const { data: questions } = await admin
      .from("ucat_questions")
      .select("id, question_stem_id, index")
      .in("question_stem_id", orderedStemIds)
      .is("deleted_at", null);
    const stemIndexById = new Map(
      orderedStemIds.map((stemId, index) => [stemId, index]),
    );
    questionIdsInOrder = [...(questions ?? [])]
      .sort(
        (a, b) =>
          (stemIndexById.get(a.question_stem_id) ?? Number.MAX_SAFE_INTEGER) -
            (stemIndexById.get(b.question_stem_id) ??
              Number.MAX_SAFE_INTEGER) ||
          a.index - b.index,
      )
      .map((question) => question.id);
  }

  return {
    ...stored,
    state: mergeQuestionAttemptRowsIntoState(
      stored.state,
      attemptsResult.data,
      questionIdsInOrder,
    ),
  };
}

async function maybeFinalizeResultsAttempt(
  admin: AdminClient,
  studentId: string,
  attempt: ActiveExamAttempt,
): Promise<boolean> {
  if (!isExamAttemptAtResults(attempt.kind, attempt.engineSnapshot.phase)) {
    return false;
  }
  await finalizeExamAttemptOnServer(
    admin,
    studentId,
    attempt.kind,
    attempt.attemptId,
  );
  return true;
}

function resumeHref(kind: ExamAttemptKind, resourceId: string): string {
  switch (kind) {
    case "set":
      return `/exam/sets?id=${encodeURIComponent(resourceId)}`;
    case "mock":
      return `/exam/mocks?id=${encodeURIComponent(resourceId)}`;
    case "practice":
      return "/practice/session";
  }
}

async function loadSetSectionNumber(
  admin: AdminClient,
  questionSetId: string,
): Promise<number | null> {
  const { data: link } = await admin
    .from("question_stems_question_sets")
    .select("question_stem_id")
    .eq("question_set_id", questionSetId)
    .order("index")
    .limit(1)
    .maybeSingle();

  if (!link?.question_stem_id) return null;

  const { data: stem } = await admin
    .from("question_stems")
    .select("section_id")
    .eq("id", link.question_stem_id)
    .maybeSingle();

  if (!stem?.section_id) return null;

  const { data: section } = await admin
    .from("ucat_sections")
    .select("name")
    .eq("id", stem.section_id)
    .maybeSingle();

  if (!section?.name) return null;

  const sectionNumbers: Record<string, number> = {
    "Verbal Reasoning": 1,
    "Decision Making": 2,
    "Quantitative Reasoning": 3,
    "Situational Judgement": 4,
  };
  return sectionNumbers[section.name] ?? null;
}

async function buildResultsHref(
  admin: AdminClient,
  kind: ExamAttemptKind,
  attemptId: string,
  resourceId: string,
): Promise<string> {
  switch (kind) {
    case "set": {
      const sectionNumber = await loadSetSectionNumber(admin, resourceId);
      return sectionNumber != null
        ? `/progress/sections/${sectionNumber}/set-attempts/${attemptId}`
        : `/progress/set-attempts/${attemptId}`;
    }
    case "mock":
      return `/progress/mock-attempts/${attemptId}`;
    case "practice":
      return `/progress/practice-sessions/${attemptId}`;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

async function loadSetLabel(
  admin: AdminClient,
  questionSetId: string,
): Promise<string> {
  const { data } = await admin
    .from("question_sets")
    .select("name")
    .eq("id", questionSetId)
    .maybeSingle();
  if (!data?.name) return "Question set";
  if (typeof data.name === "string") return data.name;
  return "Question set";
}

async function loadMockLabel(
  admin: AdminClient,
  mockId: string,
): Promise<string> {
  const { data } = await admin
    .from("ucat_mocks")
    .select("name")
    .eq("id", mockId)
    .maybeSingle();
  return data?.name ?? "Mock exam";
}

async function loadPracticeLabel(
  admin: AdminClient,
  sectionKey: string,
  sectionName: string | null,
): Promise<string> {
  if (sectionName) return `Practice · ${sectionName}`;
  return `Practice · ${sectionKey}`;
}

function rowToActiveAttempt(
  kind: ExamAttemptKind,
  row: AttemptRowBase & {
    resourceId: string;
    label: string;
    wasTimed?: boolean;
    mockAttemptId?: string | null;
    practiceSessionId?: string | null;
    resultsHref: string;
  },
  stored: StoredExamSnapshot,
): ActiveExamAttempt {
  return {
    kind,
    attemptId: row.id,
    resourceId: row.resourceId,
    label: row.label,
    resumeHref: resumeHref(kind, row.resourceId),
    resultsHref: row.resultsHref,
    currentSegmentEndsAt: row.current_segment_ends_at,
    engineSnapshot: stored.state,
    mockAttemptId: stored.mockAttemptId,
    setAttemptIdsBySetId: stored.setAttemptIdsBySetId,
    practiceSessionId: row.practiceSessionId ?? null,
    wasTimed: row.wasTimed ?? false,
  };
}

export type GetActiveExamAttemptOptions = {
  exam?: QuestionEngineExam | null;
  readerClient?: SupabaseClient;
};

export async function getActiveExamAttempt(
  admin: AdminClient,
  studentId: string,
  options?: QuestionEngineExam | null | GetActiveExamAttemptOptions,
): Promise<ActiveExamAttempt | null> {
  const resolvedOptions: GetActiveExamAttemptOptions =
    options != null &&
    typeof options === "object" &&
    ("readerClient" in options || "exam" in options)
      ? options
      : { exam: options as QuestionEngineExam | null | undefined };
  const [setRes, mockRes, practiceRes] = await Promise.all([
    admin
      .from("student_question_set_attempts")
      .select(
        "id, question_set_id, engine_snapshot, current_segment_ends_at, completed_at, was_timed, student_ucat_mock_attempt_id",
      )
      .eq("student_id", studentId)
      .is("completed_at", null)
      .not("engine_snapshot", "is", null)
      .is("student_ucat_mock_attempt_id", null)
      .order("attempted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("student_ucat_mock_attempts")
      .select(
        "id, ucat_mock_id, engine_snapshot, current_segment_ends_at, completed_at",
      )
      .eq("student_id", studentId)
      .is("completed_at", null)
      .not("engine_snapshot", "is", null)
      .order("attempted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("student_practice_sessions")
      .select(
        "id, section_key, engine_snapshot, current_segment_ends_at, completed_at, ucat_section_id",
      )
      .eq("student_id", studentId)
      .is("completed_at", null)
      .not("engine_snapshot", "is", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (setRes.data) {
    const parsed = parseStoredSnapshot(setRes.data.engine_snapshot);
    if (parsed) {
      let stored = enrichStoredSnapshotForAttempt(
        "set",
        setRes.data.id,
        setRes.data.question_set_id,
        parsed,
      );
      stored = await reconcileSetSnapshotFromQuestionAttempts(
        admin,
        studentId,
        setRes.data.id,
        setRes.data.question_set_id,
        stored,
      );
      const label = await loadSetLabel(admin, setRes.data.question_set_id);
      const resultsHref = await buildResultsHref(
        admin,
        "set",
        setRes.data.id,
        setRes.data.question_set_id,
      );
      let attempt = rowToActiveAttempt(
        "set",
        {
          id: setRes.data.id,
          engine_snapshot: setRes.data.engine_snapshot,
          current_segment_ends_at: setRes.data.current_segment_ends_at,
          completed_at: setRes.data.completed_at,
          resourceId: setRes.data.question_set_id,
          label,
          wasTimed: setRes.data.was_timed,
          resultsHref,
        },
        stored,
      );
      if (await maybeFinalizeResultsAttempt(admin, studentId, attempt)) {
        return attempt;
      }
      const caughtAttempt = await maybeCatchUp(
        admin,
        studentId,
        attempt,
        stored,
        resolvedOptions,
      );
      if (!caughtAttempt) return null;
      attempt = caughtAttempt;
      if (await maybeFinalizeResultsAttempt(admin, studentId, attempt)) {
        return attempt;
      }
      return attempt;
    }
  }

  if (mockRes.data) {
    const parsed = parseStoredSnapshot(mockRes.data.engine_snapshot);
    if (parsed) {
      const stored = enrichStoredSnapshotForAttempt(
        "mock",
        mockRes.data.id,
        mockRes.data.ucat_mock_id,
        parsed,
      );
      const label = await loadMockLabel(admin, mockRes.data.ucat_mock_id);
      const setAttempts = await admin
        .from("student_question_set_attempts")
        .select("id, question_set_id")
        .eq("student_ucat_mock_attempt_id", mockRes.data.id)
        .eq("student_id", studentId);
      const setAttemptIdsBySetId: Record<string, string> = {
        ...stored.setAttemptIdsBySetId,
      };
      for (const row of setAttempts.data ?? []) {
        if (row.question_set_id) {
          setAttemptIdsBySetId[row.question_set_id] = row.id;
        }
      }
      stored.setAttemptIdsBySetId = setAttemptIdsBySetId;
      const resultsHref = await buildResultsHref(
        admin,
        "mock",
        mockRes.data.id,
        mockRes.data.ucat_mock_id,
      );
      let attempt = rowToActiveAttempt(
        "mock",
        {
          id: mockRes.data.id,
          engine_snapshot: mockRes.data.engine_snapshot,
          current_segment_ends_at: mockRes.data.current_segment_ends_at,
          completed_at: mockRes.data.completed_at,
          resourceId: mockRes.data.ucat_mock_id,
          label,
          mockAttemptId: mockRes.data.id,
          resultsHref,
        },
        stored,
      );
      if (await maybeFinalizeResultsAttempt(admin, studentId, attempt)) {
        return attempt;
      }
      const caughtAttempt = await maybeCatchUp(
        admin,
        studentId,
        attempt,
        stored,
        resolvedOptions,
      );
      if (!caughtAttempt) return null;
      attempt = caughtAttempt;
      if (await maybeFinalizeResultsAttempt(admin, studentId, attempt)) {
        return attempt;
      }
      return attempt;
    }
  }

  if (practiceRes.data) {
    const parsed = parseStoredSnapshot(practiceRes.data.engine_snapshot);
    if (parsed) {
      const stored = parsed;
      const { data: section } = await admin
        .from("ucat_sections")
        .select("name")
        .eq("id", practiceRes.data.ucat_section_id)
        .maybeSingle();
      const label = await loadPracticeLabel(
        admin,
        practiceRes.data.section_key,
        section?.name ?? null,
      );
      const resultsHref = await buildResultsHref(
        admin,
        "practice",
        practiceRes.data.id,
        practiceRes.data.id,
      );
      let attempt = rowToActiveAttempt(
        "practice",
        {
          id: practiceRes.data.id,
          engine_snapshot: practiceRes.data.engine_snapshot,
          current_segment_ends_at: practiceRes.data.current_segment_ends_at,
          completed_at: practiceRes.data.completed_at,
          resourceId: practiceRes.data.id,
          label,
          practiceSessionId: practiceRes.data.id,
          resultsHref,
        },
        stored,
      );
      if (await maybeFinalizeResultsAttempt(admin, studentId, attempt)) {
        return attempt;
      }
      const caughtAttempt = await maybeCatchUp(
        admin,
        studentId,
        attempt,
        stored,
        resolvedOptions,
      );
      if (!caughtAttempt) return null;
      attempt = caughtAttempt;
      if (await maybeFinalizeResultsAttempt(admin, studentId, attempt)) {
        return attempt;
      }
      return attempt;
    }
  }

  return null;
}

async function maybeCatchUp(
  admin: AdminClient,
  studentId: string,
  attempt: ActiveExamAttempt,
  stored: StoredExamSnapshot,
  options: GetActiveExamAttemptOptions = {},
): Promise<ActiveExamAttempt | null> {
  if (!attempt.currentSegmentEndsAt) return attempt;

  const endsAtMs = new Date(attempt.currentSegmentEndsAt).getTime();
  if (endsAtMs > Date.now()) return attempt;

  const examForCatchUp = await resolveExamForCatchUp(attempt, {
    exam: options.exam,
    stored,
    readerClient: options.readerClient,
  });
  if (!examForCatchUp) return attempt;

  const caught = catchUpExpiredSegments(
    examForCatchUp,
    attempt.engineSnapshot,
    attempt.currentSegmentEndsAt,
    { practice: attempt.kind === "practice" },
  );
  if (
    caught.state.phase === attempt.engineSnapshot.phase &&
    caught.currentSegmentEndsAt === attempt.currentSegmentEndsAt
  ) {
    return attempt;
  }
  await persistSnapshot(admin, studentId, attempt.kind, attempt.attemptId, {
    kind: attempt.kind,
    attemptId: attempt.attemptId,
    engineSnapshot: caught.state,
    currentSegmentEndsAt: caught.currentSegmentEndsAt,
    setAttemptIdsBySetId: attempt.setAttemptIdsBySetId,
    exam: {
      sourceType: examForCatchUp.sourceType,
      sourceId: examForCatchUp.sourceId,
      practice: attempt.kind === "practice",
    },
    examTiming: stored.examTiming ?? toStoredExamTiming(examForCatchUp),
    mockAttemptId: attempt.mockAttemptId,
    questionActiveTiming: null,
  });
  const updated: ActiveExamAttempt = {
    ...attempt,
    engineSnapshot: caught.state,
    currentSegmentEndsAt: caught.currentSegmentEndsAt,
  };
  if (isExamAttemptAtResults(attempt.kind, caught.state.phase)) {
    await finalizeExamAttemptOnServer(
      admin,
      studentId,
      attempt.kind,
      attempt.attemptId,
    );
    return updated;
  }
  return updated;
}

async function loadPersistedAttemptSnapshot(
  admin: AdminClient,
  studentId: string,
  kind: ExamAttemptKind,
  attemptId: string,
): Promise<PersistedAttemptSnapshot> {
  const select = "completed_at, engine_snapshot, current_segment_ends_at";
  if (kind === "set") {
    const { data } = await admin
      .from("student_question_set_attempts")
      .select(select)
      .eq("id", attemptId)
      .eq("student_id", studentId)
      .maybeSingle();
    return {
      inProgress: data != null && data.completed_at == null,
      stored: parseStoredSnapshot(data?.engine_snapshot ?? null),
      currentSegmentEndsAt: data?.current_segment_ends_at ?? null,
    };
  }
  if (kind === "mock") {
    const { data } = await admin
      .from("student_ucat_mock_attempts")
      .select(select)
      .eq("id", attemptId)
      .eq("student_id", studentId)
      .maybeSingle();
    return {
      inProgress: data != null && data.completed_at == null,
      stored: parseStoredSnapshot(data?.engine_snapshot ?? null),
      currentSegmentEndsAt: data?.current_segment_ends_at ?? null,
    };
  }
  const { data } = await admin
    .from("student_practice_sessions")
    .select(select)
    .eq("id", attemptId)
    .eq("student_id", studentId)
    .maybeSingle();
  return {
    inProgress: data != null && data.completed_at == null,
    stored: parseStoredSnapshot(data?.engine_snapshot ?? null),
    currentSegmentEndsAt: data?.current_segment_ends_at ?? null,
  };
}

function clampIntervalEnd(
  startedAt: string,
  requestedEnd: Date,
  segmentEndsAt: string | null,
): Date {
  const startedMs = new Date(startedAt).getTime();
  const segmentEndMs = segmentEndsAt ? new Date(segmentEndsAt).getTime() : null;
  const requestedMs = requestedEnd.getTime();
  const endMs =
    segmentEndMs != null ? Math.min(requestedMs, segmentEndMs) : requestedMs;
  return new Date(Math.max(startedMs, endMs));
}

function toQuestionAttemptMode(mode: QuestionActiveTimingContext["mode"]) {
  if (mode === "questionStem") return "question_stem";
  if (mode === "questions") return "question";
  return mode;
}

function isSameQuestionTimingContext(
  previous: QuestionActiveTimingState,
  current: QuestionActiveTimingContext,
): boolean {
  return (
    previous.questionId === current.questionId &&
    previous.questionSetId === current.questionSetId &&
    previous.mode === current.mode &&
    previous.wasTimed === current.wasTimed
  );
}

async function ensureMockSetAttempt(
  admin: AdminClient,
  studentId: string,
  mockAttemptId: string,
  questionSetId: string,
  wasTimed: boolean,
): Promise<string | null> {
  const { data: existing } = await admin
    .from("student_question_set_attempts")
    .select("id")
    .eq("student_id", studentId)
    .eq("student_ucat_mock_attempt_id", mockAttemptId)
    .eq("question_set_id", questionSetId)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: inserted, error } = await admin
    .from("student_question_set_attempts")
    .insert({
      student_id: studentId,
      question_set_id: questionSetId,
      student_ucat_mock_attempt_id: mockAttemptId,
      was_timed: wasTimed,
    })
    .select("id")
    .maybeSingle();
  if (error || !inserted?.id) return null;
  return inserted.id;
}

async function resolveQuestionTimingSetAttemptId({
  admin,
  studentId,
  kind,
  attemptId,
  setAttemptIdsBySetId,
  context,
}: {
  admin: AdminClient;
  studentId: string;
  kind: ExamAttemptKind;
  attemptId: string;
  setAttemptIdsBySetId: Record<string, string>;
  context: QuestionActiveTimingContext;
}): Promise<string | null> {
  if (kind === "practice") return null;
  if (kind === "set") return attemptId;
  return (
    setAttemptIdsBySetId[context.questionSetId] ??
    (await ensureMockSetAttempt(
      admin,
      studentId,
      attemptId,
      context.questionSetId,
      context.wasTimed,
    ))
  );
}

async function incrementQuestionActiveTime({
  admin,
  studentId,
  kind,
  attemptId,
  setAttemptIdsBySetId,
  context,
  elapsedSeconds,
}: {
  admin: AdminClient;
  studentId: string;
  kind: ExamAttemptKind;
  attemptId: string;
  setAttemptIdsBySetId: Record<string, string>;
  context: QuestionActiveTimingContext;
  elapsedSeconds: number;
}): Promise<Record<string, string>> {
  if (elapsedSeconds <= 0) return setAttemptIdsBySetId;

  const nextSetAttemptIds = { ...setAttemptIdsBySetId };
  const setAttemptId = await resolveQuestionTimingSetAttemptId({
    admin,
    studentId,
    kind,
    attemptId,
    setAttemptIdsBySetId: nextSetAttemptIds,
    context,
  });
  if (kind === "mock" && setAttemptId) {
    nextSetAttemptIds[context.questionSetId] = setAttemptId;
  }

  let query = admin
    .from("student_question_attempts")
    .select("id, time_spent_seconds")
    .eq("student_id", studentId)
    .eq("question_id", context.questionId);

  if (kind === "practice") {
    query = query
      .is("student_question_set_attempt_id", null)
      .eq("student_practice_session_id", attemptId);
  } else if (setAttemptId) {
    query = query.eq("student_question_set_attempt_id", setAttemptId);
  } else {
    return nextSetAttemptIds;
  }

  const { data: existing } = await query.maybeSingle();
  const nextSeconds = Math.max(
    0,
    (existing?.time_spent_seconds ?? 0) + elapsedSeconds,
  );

  if (existing?.id) {
    await admin
      .from("student_question_attempts")
      .update({
        time_spent_seconds: nextSeconds,
        was_timed: context.wasTimed,
        mode: toQuestionAttemptMode(context.mode),
      })
      .eq("id", existing.id)
      .eq("student_id", studentId);
    return nextSetAttemptIds;
  }

  await admin.from("student_question_attempts").insert({
    student_id: studentId,
    student_question_set_attempt_id: kind === "practice" ? null : setAttemptId,
    student_practice_session_id: kind === "practice" ? attemptId : null,
    question_id: context.questionId,
    question_answer_option_id: null,
    answer_snapshot: null,
    is_flagged: false,
    is_submitted: false,
    time_spent_seconds: nextSeconds,
    was_timed: context.wasTimed,
    mode: toQuestionAttemptMode(context.mode),
  });
  return nextSetAttemptIds;
}

async function applyQuestionActiveTiming({
  admin,
  studentId,
  kind,
  attemptId,
  previous,
  current,
  segmentEndsAt,
  setAttemptIdsBySetId,
}: {
  admin: AdminClient;
  studentId: string;
  kind: ExamAttemptKind;
  attemptId: string;
  previous: QuestionActiveTimingState | null | undefined;
  current: QuestionActiveTimingContext | null | undefined;
  segmentEndsAt: string | null;
  setAttemptIdsBySetId: Record<string, string>;
}): Promise<{
  activeQuestionTiming: QuestionActiveTimingState | null;
  setAttemptIdsBySetId: Record<string, string>;
}> {
  const now = new Date();
  let nextSetAttemptIds = { ...setAttemptIdsBySetId };

  if (
    previous?.questionId &&
    current?.questionId &&
    isSameQuestionTimingContext(previous, current)
  ) {
    return {
      activeQuestionTiming: {
        ...previous,
        segmentEndsAt,
      },
      setAttemptIdsBySetId: nextSetAttemptIds,
    };
  }

  if (previous?.questionId && previous.startedAt) {
    const intervalEnd = clampIntervalEnd(
      previous.startedAt,
      now,
      previous.segmentEndsAt ?? segmentEndsAt,
    );
    const elapsedSeconds = Math.max(
      0,
      Math.floor(
        (intervalEnd.getTime() - new Date(previous.startedAt).getTime()) /
          1000,
      ),
    );
    nextSetAttemptIds = await incrementQuestionActiveTime({
      admin,
      studentId,
      kind,
      attemptId,
      setAttemptIdsBySetId: nextSetAttemptIds,
      context: previous,
      elapsedSeconds,
    });
  }

  if (!current?.questionId) {
    return {
      activeQuestionTiming: null,
      setAttemptIdsBySetId: nextSetAttemptIds,
    };
  }

  return {
    activeQuestionTiming: {
      ...current,
      startedAt: now.toISOString(),
      segmentEndsAt,
    },
    setAttemptIdsBySetId: nextSetAttemptIds,
  };
}

async function persistSnapshot(
  admin: AdminClient,
  studentId: string,
  kind: ExamAttemptKind,
  attemptId: string,
  input: SyncExamAttemptInput & {
    exam?: StoredExamSnapshot["exam"];
    examTiming?: StoredExamTiming;
    mockAttemptId?: string | null;
  },
): Promise<Record<string, string> | null> {
  const persisted = await loadPersistedAttemptSnapshot(
    admin,
    studentId,
    kind,
    attemptId,
  );
  if (!persisted.inProgress) {
    return null;
  }

  let setAttemptIdsBySetId = input.setAttemptIdsBySetId ?? {};
  if (persisted.stored?.setAttemptIdsBySetId) {
    setAttemptIdsBySetId = {
      ...persisted.stored.setAttemptIdsBySetId,
      ...setAttemptIdsBySetId,
    };
  }
  let mockAttemptId = input.mockAttemptId ?? null;
  if (kind === "set" && input.exam?.sourceId) {
    setAttemptIdsBySetId = {
      ...setAttemptIdsBySetId,
      [input.exam.sourceId]:
        setAttemptIdsBySetId[input.exam.sourceId] ?? attemptId,
    };
  }
  if (kind === "mock") {
    mockAttemptId = mockAttemptId ?? attemptId;
  }
  mockAttemptId = mockAttemptId ?? persisted.stored?.mockAttemptId ?? null;

  const currentSegmentEndsAt = input.currentSegmentEndsAt;
  const nextState: ExamEngineSnapshot = { ...input.engineSnapshot };

  if ("questionActiveTiming" in input) {
    const timed = await applyQuestionActiveTiming({
      admin,
      studentId,
      kind,
      attemptId,
      previous: persisted.stored?.state.activeQuestionTiming,
      current: input.questionActiveTiming,
      segmentEndsAt: currentSegmentEndsAt,
      setAttemptIdsBySetId,
    });
    setAttemptIdsBySetId = timed.setAttemptIdsBySetId;
    nextState.activeQuestionTiming = timed.activeQuestionTiming;
  } else {
    nextState.activeQuestionTiming =
      persisted.stored?.state.activeQuestionTiming ?? null;
  }

  const stored = wrapStoredSnapshot({
    state: nextState,
    exam: input.exam ?? {
      sourceType:
        kind === "set" ? "set" : kind === "mock" ? "mock" : "questionStem",
      sourceId: attemptId,
      practice: kind === "practice",
    },
    examTiming: input.examTiming,
    setAttemptIdsBySetId,
    mockAttemptId,
  });

  const payload = {
    engine_snapshot: stored as unknown as Json,
    current_segment_ends_at: currentSegmentEndsAt,
  };

  if (kind === "set") {
    await admin
      .from("student_question_set_attempts")
      .update(payload)
      .eq("id", attemptId)
      .eq("student_id", studentId);
    return setAttemptIdsBySetId;
  }
  if (kind === "mock") {
    await admin
      .from("student_ucat_mock_attempts")
      .update(payload)
      .eq("id", attemptId)
      .eq("student_id", studentId);
    return setAttemptIdsBySetId;
  }
  await admin
    .from("student_practice_sessions")
    .update(payload)
    .eq("id", attemptId)
    .eq("student_id", studentId);
  return setAttemptIdsBySetId;
}

export async function checkExamAttemptConflict(
  admin: AdminClient,
  studentId: string,
  kind: ExamAttemptKind,
  resourceId: string,
): Promise<ActiveExamAttempt | null> {
  const active = await getActiveExamAttempt(admin, studentId);
  if (!active) return null;
  if (active.kind === kind && active.resourceId === resourceId) return null;
  return active;
}

export async function beginExamAttempt(
  admin: AdminClient,
  studentId: string,
  input: BeginExamAttemptInput,
  examMeta: StoredExamSnapshot["exam"],
  examTiming?: StoredExamTiming,
): Promise<{ attempt: ActiveExamAttempt; resumed: boolean }> {
  const existing = await resumeExistingExamAttempt(
    admin,
    studentId,
    input.kind,
    input.resourceId,
  );
  if (existing) {
    return { attempt: existing, resumed: true };
  }

  const conflict = await checkExamAttemptConflict(
    admin,
    studentId,
    input.kind,
    input.resourceId,
  );
  if (conflict) {
    throw new Error("EXAM_ATTEMPT_IN_PROGRESS");
  }

  const endsAt = computeSegmentEndsAt(input.segmentTimeLimitSeconds);
  const stored = wrapStoredSnapshot({
    state: input.engineSnapshot,
    exam: examMeta,
    examTiming,
    setAttemptIdsBySetId: {},
    mockAttemptId: null,
  });

  if (input.kind === "set") {
    const quotaCheck = await checkQuotaForAction(admin, studentId, "sets");
    if (!quotaCheck.allowed) {
      throw new Error(`QUOTA_EXCEEDED:${JSON.stringify(quotaCheck.payload)}`);
    }
    const { data, error } = await admin
      .from("student_question_set_attempts")
      .insert({
        student_id: studentId,
        question_set_id: input.resourceId,
        was_timed: input.wasTimed,
        engine_snapshot: stored as unknown as Json,
        current_segment_ends_at: endsAt,
      })
      .select("id, question_set_id, was_timed")
      .maybeSingle();
    if (error || !data) throw new Error(error?.message ?? "Failed to begin set");
    const enrichedStored = enrichStoredSnapshotForAttempt(
      "set",
      data.id,
      data.question_set_id,
      {
        ...stored,
        setAttemptIdsBySetId: { [data.question_set_id]: data.id },
      },
    );
    await admin
      .from("student_question_set_attempts")
      .update({ engine_snapshot: enrichedStored as unknown as Json })
      .eq("id", data.id)
      .eq("student_id", studentId);
    const label = await loadSetLabel(admin, data.question_set_id);
    const resultsHref = await buildResultsHref(
      admin,
      "set",
      data.id,
      data.question_set_id,
    );
    return {
      attempt: {
        kind: "set",
        attemptId: data.id,
        resourceId: data.question_set_id,
        label,
        resumeHref: resumeHref("set", data.question_set_id),
        resultsHref,
        currentSegmentEndsAt: endsAt,
        engineSnapshot: input.engineSnapshot,
        mockAttemptId: null,
        setAttemptIdsBySetId: { [data.question_set_id]: data.id },
        practiceSessionId: null,
        wasTimed: data.was_timed,
      },
      resumed: false,
    };
  }

  if (input.kind === "mock") {
    const quotaCheck = await checkQuotaForAction(admin, studentId, "mocks");
    if (!quotaCheck.allowed) {
      throw new Error(`QUOTA_EXCEEDED:${JSON.stringify(quotaCheck.payload)}`);
    }
    const { data, error } = await admin
      .from("student_ucat_mock_attempts")
      .insert({
        student_id: studentId,
        ucat_mock_id: input.resourceId,
        engine_snapshot: stored as unknown as Json,
        current_segment_ends_at: endsAt,
      })
      .select("id, ucat_mock_id")
      .maybeSingle();
    if (error || !data) throw new Error(error?.message ?? "Failed to begin mock");

    const setAttemptIdsBySetId: Record<string, string> = {};
    if (input.questionSetIdForMockSet) {
      const { data: setAttempt, error: setError } = await admin
        .from("student_question_set_attempts")
        .insert({
          student_id: studentId,
          question_set_id: input.questionSetIdForMockSet,
          student_ucat_mock_attempt_id: data.id,
          was_timed: input.wasTimed,
        })
        .select("id, question_set_id")
        .maybeSingle();
      if (setError || !setAttempt) {
        throw new Error(setError?.message ?? "Failed to begin mock set attempt");
      }
      setAttemptIdsBySetId[setAttempt.question_set_id] = setAttempt.id;
      stored.setAttemptIdsBySetId = setAttemptIdsBySetId;
      stored.mockAttemptId = data.id;
      await admin
        .from("student_ucat_mock_attempts")
        .update({ engine_snapshot: stored as unknown as Json })
        .eq("id", data.id);
    }

    const label = await loadMockLabel(admin, data.ucat_mock_id);
    const resultsHref = await buildResultsHref(
      admin,
      "mock",
      data.id,
      data.ucat_mock_id,
    );
    return {
      attempt: {
        kind: "mock",
        attemptId: data.id,
        resourceId: data.ucat_mock_id,
        label,
        resumeHref: resumeHref("mock", data.ucat_mock_id),
        resultsHref,
        currentSegmentEndsAt: endsAt,
        engineSnapshot: input.engineSnapshot,
        mockAttemptId: data.id,
        setAttemptIdsBySetId,
        practiceSessionId: null,
        wasTimed: input.wasTimed,
      },
      resumed: false,
    };
  }

  const sessionId = input.practiceSessionId ?? input.resourceId;
  const { data: session, error } = await admin
    .from("student_practice_sessions")
    .update({
      engine_snapshot: stored as unknown as Json,
      current_segment_ends_at: endsAt,
    })
    .eq("id", sessionId)
    .eq("student_id", studentId)
    .is("completed_at", null)
    .select("id, section_key, ucat_section_id")
    .maybeSingle();
  if (error || !session) {
    throw new Error(error?.message ?? "Practice session not found");
  }
  const { data: section } = await admin
    .from("ucat_sections")
    .select("name")
    .eq("id", session.ucat_section_id)
    .maybeSingle();
  const label = await loadPracticeLabel(
    admin,
    session.section_key,
    section?.name ?? null,
  );
  const resultsHref = await buildResultsHref(
    admin,
    "practice",
    session.id,
    session.id,
  );
  return {
    attempt: {
      kind: "practice",
      attemptId: session.id,
      resourceId: session.id,
      label,
      resumeHref: resumeHref("practice", session.id),
      resultsHref,
      currentSegmentEndsAt: endsAt,
      engineSnapshot: input.engineSnapshot,
      mockAttemptId: null,
      setAttemptIdsBySetId: {},
      practiceSessionId: session.id,
      wasTimed: input.wasTimed,
    },
    resumed: false,
  };
}

export async function resumeExistingExamAttempt(
  admin: AdminClient,
  studentId: string,
  kind: ExamAttemptKind,
  resourceId: string,
  exam?: QuestionEngineExam | null,
): Promise<ActiveExamAttempt | null> {
  const active = await getActiveExamAttempt(admin, studentId, exam);
  if (!active || active.kind !== kind || active.resourceId !== resourceId) {
    return null;
  }
  return active;
}

export async function syncExamAttempt(
  admin: AdminClient,
  studentId: string,
  input: SyncExamAttemptInput,
  examMeta?: StoredExamSnapshot["exam"],
  mockAttemptId?: string | null,
  examTiming?: StoredExamTiming,
): Promise<{
  currentSegmentEndsAt: string | null;
  setAttemptIdsBySetId: Record<string, string>;
}> {
  const currentSegmentEndsAt =
    input.startSegmentTimeLimitSeconds !== undefined
      ? computeSegmentEndsAt(input.startSegmentTimeLimitSeconds)
      : input.currentSegmentEndsAt;
  const setAttemptIdsBySetId =
    (await persistSnapshot(admin, studentId, input.kind, input.attemptId, {
      ...input,
      currentSegmentEndsAt,
      exam: examMeta,
      examTiming,
      mockAttemptId,
    })) ??
    input.setAttemptIdsBySetId ??
    {};
  return { currentSegmentEndsAt, setAttemptIdsBySetId };
}

export async function clearExamAttemptProgress(
  admin: AdminClient,
  studentId: string,
  kind: ExamAttemptKind,
  attemptId: string,
): Promise<void> {
  const persisted = await loadPersistedAttemptSnapshot(
    admin,
    studentId,
    kind,
    attemptId,
  );
  if (persisted.inProgress && persisted.stored?.state.activeQuestionTiming) {
    await persistSnapshot(admin, studentId, kind, attemptId, {
      kind,
      attemptId,
      engineSnapshot: {
        ...persisted.stored.state,
        activeQuestionTiming: null,
      },
      currentSegmentEndsAt: persisted.currentSegmentEndsAt,
      setAttemptIdsBySetId: persisted.stored.setAttemptIdsBySetId,
      exam: persisted.stored.exam,
      examTiming: persisted.stored.examTiming,
      mockAttemptId: persisted.stored.mockAttemptId,
      questionActiveTiming: null,
    });
  }

  const payload = {
    engine_snapshot: null,
    current_segment_ends_at: null,
  };
  if (kind === "set") {
    await admin
      .from("student_question_set_attempts")
      .update(payload)
      .eq("id", attemptId)
      .eq("student_id", studentId);
    return;
  }
  if (kind === "mock") {
    await admin
      .from("student_ucat_mock_attempts")
      .update(payload)
      .eq("id", attemptId)
      .eq("student_id", studentId);
    return;
  }
  await admin
    .from("student_practice_sessions")
    .update(payload)
    .eq("id", attemptId)
    .eq("student_id", studentId);
}
