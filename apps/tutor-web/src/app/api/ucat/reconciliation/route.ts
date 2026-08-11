import { captureApiErrorResponse } from "@/lib/sentry/capture-api-error";
import { NextResponse } from "next/server";
import { requireUcatTutor } from "@/features/ucat/shared/server/guard";
import {
  getSetSectionStatus,
  parseSetSections,
  formatSetSectionsDisplay,
  isMockSetOrderCorrect,
} from "@/features/ucat/shared/lib/set-section-status";
import { proseMirrorToPlainText } from "@/features/ucat/shared/lib/rich-text";
import type { UcatSectionForStatus } from "@/features/ucat/shared/lib/set-section-status";
import type { Json } from "@altitutor/shared";
import {
  getOpenExplanationFeedback,
  getOpenQuestionFeedback,
} from "@/features/ucat/reconciliation/server/explanation-feedback";

function hasExplanation(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  const content = rec.content;
  if (!Array.isArray(content)) return false;
  const text = content
    .flatMap((node) => {
      if (!node || typeof node !== "object") return [];
      const n = node as Record<string, unknown>;
      const c = n.content;
      if (!Array.isArray(c)) return [];
      return c
        .map((child) =>
          child && typeof child === "object" && "text" in child
            ? String((child as { text?: string }).text ?? "")
            : "",
        )
        .join("");
    })
    .join("");
  return text.trim().length > 0;
}

type QuestionRow = {
  id: string;
  question_text: unknown;
  answer_explanation: unknown;
  index: number;
  deleted_at?: string | null;
  tags?: Array<{ id: string; name: string }> | null;
  answer_options?: Array<{
    answer_text?: unknown;
    answer_explanation: unknown;
    index?: number;
    is_answer?: boolean | null;
    deleted_at?: string | null;
  }>;
};

function questionIsUntagged(q: QuestionRow): boolean {
  if (q.deleted_at) return false;
  const tags = q.tags;
  return tags == null || (Array.isArray(tags) && tags.length === 0);
}

function questionLacksExplanation(q: QuestionRow): boolean {
  if (q.deleted_at) return false;

  const hasQuestionExplanation = hasExplanation(q.answer_explanation);
  if (hasQuestionExplanation) return false;

  const options = (q.answer_options ?? []).filter((opt) => !opt.deleted_at);
  if (options.length === 0) return true;
  const allOptionsHaveExplanation = options.every((opt) =>
    hasExplanation(opt.answer_explanation),
  );
  return !allOptionsHaveExplanation;
}

function parseSetNames(setNames: unknown): string[] {
  if (!Array.isArray(setNames)) return [];
  return setNames
    .map((name) => proseMirrorToPlainText(name as Json)?.trim() || "Untitled")
    .filter(Boolean);
}

function parseSetIds(setIds: unknown): string[] {
  if (!Array.isArray(setIds)) return [];
  return setIds.filter((id): id is string => typeof id === "string");
}

function parseStemSets(
  setNames: unknown,
  setIds: unknown,
): Array<{ id: string; name: string }> {
  const ids = parseSetIds(setIds);
  const names = Array.isArray(setNames) ? setNames : [];
  return ids.map((id, index) => ({
    id,
    name:
      proseMirrorToPlainText(names[index] as Json)?.trim() || "Untitled",
  }));
}

type ModuleBlockAttachmentRow = {
  question_stem_id: string | null;
  question_id: string | null;
};

type SessionStemAttachmentRow = {
  question_stem_id: string | null;
};

function buildStemIdsAttachedToModulesOrSessions(
  moduleBlocks: ModuleBlockAttachmentRow[],
  sessionResources: SessionStemAttachmentRow[],
  questionStemIdByQuestionId: Map<string, string>,
): Set<string> {
  const attached = new Set<string>();
  for (const resource of sessionResources) {
    if (resource.question_stem_id) attached.add(resource.question_stem_id);
  }
  for (const block of moduleBlocks) {
    if (block.question_stem_id) attached.add(block.question_stem_id);
    if (block.question_id) {
      const stemId = questionStemIdByQuestionId.get(block.question_id);
      if (stemId) attached.add(stemId);
    }
  }
  return attached;
}

type StemDetailRow = {
  id: string;
  section_id: string;
  section_name: string;
  stem_text: unknown;
  question_stem_category_id: string | null;
  category_name?: string | null;
  deleted_at: string | null;
  questions: QuestionRow[];
};

export async function GET() {
  const access = await requireUcatTutor();
  if (!access.ok) return access.response;

  // These views are independent. Fetch them in one concurrent wave so the endpoint
  // pays for the slowest query instead of the sum of every query's latency.
  const [
    stemsResult,
    stemsListResult,
    sectionsResult,
    setsResult,
    mockDetailsResult,
    moduleBlocksResult,
    sessionResourcesResult,
  ] = await Promise.all([
    access.userClient
      .from("vtutor_ucat_question_stem_detail")
      .select(
        "id,section_id,section_name,stem_text,question_stem_category_id,category_name,deleted_at,questions",
      )
      .is("deleted_at", null),
    access.userClient
      .from("vtutor_ucat_question_stems")
      .select("id,access_scope,set_names,set_ids")
      .is("deleted_at", null),
    access.userClient
      .from("vtutor_ucat_sections")
      .select("id,section_number,name,number_of_questions,time_limit_seconds"),
    access.userClient
      .from("vtutor_ucat_question_sets")
      .select("id,name,sections,stem_count,question_count,time_limit_seconds")
      .is("deleted_at", null),
    access.userClient
      .from("vtutor_ucat_mock_detail")
      .select("id,name,sets")
      .is("deleted_at", null),
    access.userClient
      .from("vtutor_ucat_learning_module_blocks")
      .select("question_stem_id,question_id")
      .is("deleted_at", null),
    access.userClient
      .from("vtutor_ucat_sessions_resources")
      .select("question_stem_id")
      .not("question_stem_id", "is", null),
  ]);

  for (const result of [
    stemsResult,
    stemsListResult,
    sectionsResult,
    setsResult,
    mockDetailsResult,
    moduleBlocksResult,
    sessionResourcesResult,
  ]) {
    if (result.error) {
      return captureApiErrorResponse(
        result.error,
        "/api/ucat/reconciliation",
        NextResponse.json({ error: result.error.message }, { status: 500 }),
      );
    }
  }

  const rows = (stemsResult.data ?? []) as StemDetailRow[];
  const questionStemIdByQuestionId = new Map<string, string>();
  for (const stem of rows) {
    for (const question of stem.questions ?? []) {
      if (question.deleted_at) continue;
      questionStemIdByQuestionId.set(question.id, stem.id);
    }
  }
  const attachedStemIds = buildStemIdsAttachedToModulesOrSessions(
    (moduleBlocksResult.data ?? []) as ModuleBlockAttachmentRow[],
    (sessionResourcesResult.data ?? []) as SessionStemAttachmentRow[],
    questionStemIdByQuestionId,
  );
  const [explanationFeedback, questionFeedback] = await Promise.all([
    getOpenExplanationFeedback(),
    getOpenQuestionFeedback(),
  ]);
  const explanationFeedbackByQuestion = new Map(
    explanationFeedback.map((feedback) => [feedback.questionId, feedback]),
  );
  const questionFeedbackByQuestion = new Map(
    questionFeedback.map((feedback) => [feedback.questionId, feedback]),
  );

  const downvotedExplanations = rows
    .flatMap((stem) =>
      (stem.questions ?? []).flatMap((question) => {
        if (question.deleted_at) return [];
        const feedback = explanationFeedbackByQuestion.get(question.id);
        if (!feedback || feedback.downvotes === 0) return [];
        return [
          {
            stemId: stem.id,
            stemText: stem.stem_text,
            sectionId: stem.section_id,
            sectionName: stem.section_name ?? "",
            questionText: question.question_text,
            questionIndex: question.index,
            ...feedback,
          },
        ];
      }),
    )
    .sort(
      (left, right) =>
        right.downvotes - left.downvotes ||
        right.latestAt.localeCompare(left.latestAt),
    );

  const downvotedQuestions = rows
    .flatMap((stem) =>
      (stem.questions ?? []).flatMap((question) => {
        if (question.deleted_at) return [];
        const feedback = questionFeedbackByQuestion.get(question.id);
        if (!feedback || feedback.downvotes === 0) return [];
        return [
          {
            stemId: stem.id,
            stemText: stem.stem_text,
            sectionId: stem.section_id,
            sectionName: stem.section_name ?? "",
            questionText: question.question_text,
            questionIndex: question.index,
            ...feedback,
          },
        ];
      }),
    )
    .sort(
      (left, right) =>
        right.downvotes - left.downvotes ||
        right.latestAt.localeCompare(left.latestAt),
    );

  const privateStemIdsNotInSet = new Set<string>();
  const stemIdsInMultipleSets = new Set<string>();
  const setsByStemId = new Map<string, Array<{ id: string; name: string }>>();
  for (const s of stemsListResult.data ?? []) {
    const row = s as {
      id: string;
      access_scope: "public" | "private";
      set_names: unknown;
      set_ids: unknown;
    };
    const sets = parseStemSets(row.set_names, row.set_ids);
    setsByStemId.set(row.id, sets);
    if (sets.length > 1) {
      stemIdsInMultipleSets.add(row.id);
    }
    const setNames = parseSetNames(row.set_names);
    if (row.access_scope !== "private") continue;
    if (setNames.length === 0 && !attachedStemIds.has(row.id)) {
      privateStemIdsNotInSet.add(row.id);
    }
  }

  const stemsWithNoCategory = rows
    .filter((r) => !r.question_stem_category_id)
    .map((r) => ({
      id: r.id,
      sectionId: r.section_id,
      sectionName: r.section_name ?? "",
      stemText: r.stem_text,
      questions: (r.questions ?? []) as QuestionRow[],
    }));

  const questionsWithNoExplanation: Array<{
    stemId: string;
    stemText: unknown;
    sectionId: string;
    sectionName: string;
    questionId: string;
    questionText: unknown;
    questionIndex: number;
  }> = [];

  for (const stem of rows) {
    const questions = (stem.questions ?? []) as QuestionRow[];
    for (const q of questions) {
      if (questionLacksExplanation(q)) {
        questionsWithNoExplanation.push({
          stemId: stem.id,
          stemText: stem.stem_text,
          sectionId: stem.section_id,
          sectionName: stem.section_name ?? "",
          questionId: q.id,
          questionText: q.question_text,
          questionIndex: q.index,
        });
      }
    }
  }

  const untaggedQuestions: Array<{
    stemId: string;
    stemText: unknown;
    sectionId: string;
    sectionName: string;
    questionId: string;
    questionText: unknown;
    questionIndex: number;
    answerOptions: QuestionRow["answer_options"];
  }> = [];
  for (const stem of rows) {
    const questions = (stem.questions ?? []) as QuestionRow[];
    for (const q of questions) {
      if (questionIsUntagged(q)) {
        untaggedQuestions.push({
          stemId: stem.id,
          stemText: stem.stem_text,
          sectionId: stem.section_id,
          sectionName: stem.section_name ?? "",
          questionId: q.id,
          questionText: q.question_text,
          questionIndex: q.index,
          answerOptions: q.answer_options ?? [],
        });
      }
    }
  }

  const privateStemsNotInSet = rows
    .filter((r) => privateStemIdsNotInSet.has(r.id))
    .map((r) => ({
      id: r.id,
      sectionId: r.section_id,
      sectionName: r.section_name ?? "",
      categoryId: r.question_stem_category_id,
      categoryName: r.category_name ?? null,
      stemText: r.stem_text,
      questions: (r.questions ?? []) as QuestionRow[],
    }));

  const stemsInMultipleSets = rows
    .filter((r) => stemIdsInMultipleSets.has(r.id))
    .map((r) => ({
      id: r.id,
      sectionId: r.section_id,
      sectionName: r.section_name ?? "",
      categoryId: r.question_stem_category_id,
      categoryName: r.category_name ?? null,
      stemText: r.stem_text,
      sets: setsByStemId.get(r.id) ?? [],
      questions: (r.questions ?? []) as QuestionRow[],
    }))
    .sort((left, right) => right.sets.length - left.sets.length);

  // Exact + high-confidence near-copy duplicates have their own indexed,
  // paginated queue. Keeping the former fuzzy scan out of this legacy report
  // prevents unrelated issue pages, sets, and mocks from paying its O(n²)
  // request-time cost.
  const potentialDuplicatePairs: never[] = [];

  const sections: UcatSectionForStatus[] = (sectionsResult.data ?? []).map(
    (s) => {
      const row = s as {
        id?: string;
        section_number?: number;
        name?: unknown;
        number_of_questions?: number;
        time_limit_seconds?: number;
      };
      const nameVal = row.name;
      const nameStr: string | null =
        nameVal == null
          ? null
          : typeof nameVal === "string"
            ? nameVal
            : (proseMirrorToPlainText(
                nameVal as import("@altitutor/shared").Json,
              ) ?? null);
      return {
        id: row.id ?? null,
        section_number: row.section_number ?? null,
        name: nameStr ?? null,
        number_of_questions: row.number_of_questions ?? null,
        time_limit_seconds: row.time_limit_seconds ?? null,
      };
    },
  );

  const allSets = (setsResult.data ?? []) as Array<{
    id: string;
    name: unknown;
    sections: unknown;
    stem_count: number;
    question_count: number;
    time_limit_seconds: number | null;
  }>;

  type SetReconciliationRow = {
    id: string;
    name: string;
    sectionDisplay: string;
    stemCount: number;
    questionCount: number;
    timeLimitSeconds: number | null;
    sectionCount: number;
    firstSectionNumber: number | null;
    questionCountStatus: "match" | "mismatch";
    questionCountTooltip: string;
    timeLimitStatus: "match" | "partial" | "mismatch" | "untimed";
    timeLimitTooltip: string;
  };

  const setRows: SetReconciliationRow[] = allSets.map((s) => {
    const parsed = parseSetSections(s.sections ?? null);
    const status = getSetSectionStatus(
      {
        sectionCount: parsed.sectionCount,
        firstSectionNumber: parsed.firstSectionNumber,
        question_count: s.question_count ?? null,
        time_limit_seconds: s.time_limit_seconds ?? null,
      },
      sections,
    );
    const nameStr =
      proseMirrorToPlainText(
        s.name as import("@altitutor/shared").Json,
      )?.trim() || "Untitled";
    return {
      id: s.id,
      name: nameStr,
      sectionDisplay: formatSetSectionsDisplay(s.sections ?? null),
      stemCount: s.stem_count ?? 0,
      questionCount: s.question_count ?? 0,
      timeLimitSeconds: s.time_limit_seconds ?? null,
      sectionCount: parsed.sectionCount,
      firstSectionNumber: parsed.firstSectionNumber,
      questionCountStatus: status.questionCountStatus,
      questionCountTooltip: status.questionCountTooltip,
      timeLimitStatus: status.timeLimitStatus,
      timeLimitTooltip: status.timeLimitTooltip,
    };
  });

  const setsWithIncorrectQuestionCount = setRows.filter(
    (r) => r.sectionCount === 1 && r.questionCountStatus === "mismatch",
  );
  const setsWithIncorrectTiming = setRows.filter((r) => {
    if (r.timeLimitStatus === "untimed") return false;
    if (r.timeLimitStatus === "match" && r.questionCountStatus === "mismatch")
      return false;
    return r.timeLimitStatus === "partial" || r.timeLimitStatus === "mismatch";
  });
  const setsWithMultipleSections = setRows.filter((r) => r.sectionCount > 1);

  const mocksList = (mockDetailsResult.data ?? []) as Array<{
    id: string;
    name: unknown;
    sets?: Array<{ id: string; name?: unknown; sections?: unknown }> | null;
  }>;

  const mocksWithIncorrectSets: Array<{
    id: string;
    name: string;
    setCount: number;
    sets: Array<{ id: string; name: string }>;
  }> = [];
  for (const mock of mocksList) {
    const sets = mock.sets ?? [];
    const setCount = sets.length;
    const correct = isMockSetOrderCorrect(setCount, sets, sections);
    if (!correct) {
      const mockNameStr =
        typeof mock.name === "string"
          ? mock.name.trim() || "Untitled"
          : proseMirrorToPlainText(
              mock.name as import("@altitutor/shared").Json,
            )?.trim() || "Untitled";
      const setsDisplay = sets.map((st) => ({
        id: st.id,
        name:
          proseMirrorToPlainText(
            st.name as import("@altitutor/shared").Json,
          )?.trim() || "Untitled",
      }));
      mocksWithIncorrectSets.push({
        id: mock.id,
        name: mockNameStr,
        setCount,
        sets: setsDisplay,
      });
    }
  }

  return NextResponse.json({
    stemsWithNoCategory,
    questionsWithNoExplanation,
    downvotedQuestions,
    downvotedExplanations,
    untaggedQuestions,
    privateStemsNotInSet,
    stemsInMultipleSets,
    potentialDuplicatePairs,
    setsWithIncorrectQuestionCount,
    setsWithIncorrectTiming,
    setsWithMultipleSections,
    mocksWithIncorrectSets,
  });
}
