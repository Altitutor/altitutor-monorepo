import type { Json } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuestionEngineExam } from "@/features/question-engine/model/types";
import { catchUpExpiredSegments } from "@/lib/ucat/exam-attempt/segment-catch-up";
import { computeSegmentEndsAt } from "@/lib/ucat/exam-attempt/timing";
import type {
  ActiveExamAttempt,
  BeginExamAttemptInput,
  ExamAttemptKind,
  ExamEngineSnapshot,
  SyncExamAttemptInput,
} from "@/lib/ucat/exam-attempt/types";
import {
  checkQuotaForAction,
} from "@/lib/ucat/quota/quota-service";

type AdminClient = SupabaseClient;

export type StoredExamSnapshot = {
  v: 1;
  state: ExamEngineSnapshot;
  exam: {
    sourceType: QuestionEngineExam["sourceType"];
    sourceId: string;
    practice: boolean;
  };
  setAttemptIdsBySetId: Record<string, string>;
  mockAttemptId: string | null;
};

type AttemptRowBase = {
  id: string;
  engine_snapshot: Json | null;
  current_segment_ends_at: string | null;
  completed_at: string | null;
};

export function wrapStoredSnapshot(input: {
  state: ExamEngineSnapshot;
  exam: StoredExamSnapshot["exam"];
  setAttemptIdsBySetId: Record<string, string>;
  mockAttemptId: string | null;
}): StoredExamSnapshot {
  return {
    v: 1,
    state: input.state,
    exam: input.exam,
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
    setAttemptIdsBySetId: obj.setAttemptIdsBySetId ?? {},
    mockAttemptId: obj.mockAttemptId ?? null,
  };
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
  },
  stored: StoredExamSnapshot,
): ActiveExamAttempt {
  return {
    kind,
    attemptId: row.id,
    resourceId: row.resourceId,
    label: row.label,
    resumeHref: resumeHref(kind, row.resourceId),
    currentSegmentEndsAt: row.current_segment_ends_at,
    engineSnapshot: stored.state,
    mockAttemptId: stored.mockAttemptId,
    setAttemptIdsBySetId: stored.setAttemptIdsBySetId,
    practiceSessionId: row.practiceSessionId ?? null,
    wasTimed: row.wasTimed ?? false,
  };
}

export async function getActiveExamAttempt(
  admin: AdminClient,
  studentId: string,
  exam?: QuestionEngineExam | null,
): Promise<ActiveExamAttempt | null> {
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
      .maybeSingle(),
    admin
      .from("student_ucat_mock_attempts")
      .select(
        "id, ucat_mock_id, engine_snapshot, current_segment_ends_at, completed_at",
      )
      .eq("student_id", studentId)
      .is("completed_at", null)
      .not("engine_snapshot", "is", null)
      .maybeSingle(),
    admin
      .from("student_practice_sessions")
      .select(
        "id, section_key, engine_snapshot, current_segment_ends_at, completed_at, ucat_section_id",
      )
      .eq("student_id", studentId)
      .is("completed_at", null)
      .not("engine_snapshot", "is", null)
      .maybeSingle(),
  ]);

  if (setRes.data) {
    const stored = parseStoredSnapshot(setRes.data.engine_snapshot);
    if (stored) {
      const label = await loadSetLabel(admin, setRes.data.question_set_id);
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
        },
        stored,
      );
      attempt = await maybeCatchUp(admin, studentId, attempt, exam);
      return attempt;
    }
  }

  if (mockRes.data) {
    const stored = parseStoredSnapshot(mockRes.data.engine_snapshot);
    if (stored) {
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
        },
        stored,
      );
      attempt = await maybeCatchUp(admin, studentId, attempt, exam);
      return attempt;
    }
  }

  if (practiceRes.data) {
    const stored = parseStoredSnapshot(practiceRes.data.engine_snapshot);
    if (stored) {
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
        },
        stored,
      );
      attempt = await maybeCatchUp(admin, studentId, attempt, exam);
      return attempt;
    }
  }

  return null;
}

async function maybeCatchUp(
  admin: AdminClient,
  studentId: string,
  attempt: ActiveExamAttempt,
  exam?: QuestionEngineExam | null,
): Promise<ActiveExamAttempt> {
  if (!exam || !attempt.currentSegmentEndsAt) return attempt;
  const stored = wrapStoredSnapshot({
    state: attempt.engineSnapshot,
    exam: {
      sourceType: exam.sourceType,
      sourceId: exam.sourceId,
      practice: attempt.kind === "practice",
    },
    setAttemptIdsBySetId: attempt.setAttemptIdsBySetId,
    mockAttemptId: attempt.mockAttemptId,
  });
  const caught = catchUpExpiredSegments(
    exam,
    stored.state,
    attempt.currentSegmentEndsAt,
    { practice: attempt.kind === "practice" },
  );
  if (
    caught.state === attempt.engineSnapshot &&
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
  });
  return {
    ...attempt,
    engineSnapshot: caught.state,
    currentSegmentEndsAt: caught.currentSegmentEndsAt,
  };
}

async function persistSnapshot(
  admin: AdminClient,
  studentId: string,
  kind: ExamAttemptKind,
  attemptId: string,
  input: SyncExamAttemptInput & {
    exam?: StoredExamSnapshot["exam"];
    mockAttemptId?: string | null;
  },
): Promise<void> {
  const stored = wrapStoredSnapshot({
    state: input.engineSnapshot,
    exam: input.exam ?? {
      sourceType: kind === "set" ? "set" : kind === "mock" ? "mock" : "questionStem",
      sourceId: attemptId,
      practice: kind === "practice",
    },
    setAttemptIdsBySetId: input.setAttemptIdsBySetId ?? {},
    mockAttemptId: input.mockAttemptId ?? null,
  });

  const payload = {
    engine_snapshot: stored as unknown as Json,
    current_segment_ends_at: input.currentSegmentEndsAt,
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
    const label = await loadSetLabel(admin, data.question_set_id);
    return {
      attempt: {
        kind: "set",
        attemptId: data.id,
        resourceId: data.question_set_id,
        label,
        resumeHref: resumeHref("set", data.question_set_id),
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
    return {
      attempt: {
        kind: "mock",
        attemptId: data.id,
        resourceId: data.ucat_mock_id,
        label,
        resumeHref: resumeHref("mock", data.ucat_mock_id),
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
  return {
    attempt: {
      kind: "practice",
      attemptId: session.id,
      resourceId: session.id,
      label,
      resumeHref: resumeHref("practice", session.id),
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
): Promise<void> {
  await persistSnapshot(admin, studentId, input.kind, input.attemptId, {
    ...input,
    exam: examMeta,
    mockAttemptId,
  });
}

export async function clearExamAttemptProgress(
  admin: AdminClient,
  studentId: string,
  kind: ExamAttemptKind,
  attemptId: string,
): Promise<void> {
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
