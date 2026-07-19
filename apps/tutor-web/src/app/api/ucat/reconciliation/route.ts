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
import {
  buildStemSimilarityIndexEntry,
  findPotentialDuplicatePairs,
} from "@/features/ucat/questions/lib/stem-similarity";
import {
  hasExactDuplicateContent,
  suggestMergeDirection,
} from "@/features/ucat/reconciliation/lib/duplicate-stem-comparison";
import type { Json } from "@altitutor/shared";

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

type StemListMeta = {
  isPrivate: boolean;
  setNames: string[];
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
  ] = await Promise.all([
    access.userClient
      .from("vtutor_ucat_question_stem_detail")
      .select(
        "id,section_id,section_name,stem_text,question_stem_category_id,category_name,deleted_at,questions",
      )
      .is("deleted_at", null),
    access.userClient
      .from("vtutor_ucat_question_stems")
      .select("id,access_scope,set_names")
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
  ]);

  for (const result of [
    stemsResult,
    stemsListResult,
    sectionsResult,
    setsResult,
    mockDetailsResult,
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

  const stemMetaById = new Map<string, StemListMeta>();
  const privateStemIdsNotInSet = new Set<string>();
  for (const s of stemsListResult.data ?? []) {
    const row = s as {
      id: string;
      access_scope: "public" | "private";
      set_names: unknown;
    };
    const setNames = parseSetNames(row.set_names);
    stemMetaById.set(row.id, {
      isPrivate: row.access_scope === "private",
      setNames,
    });
    if (row.access_scope !== "private") continue;
    if (setNames.length === 0) privateStemIdsNotInSet.add(row.id);
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

  const stemsById = new Map(rows.map((row) => [row.id, row]));
  const potentialDuplicatePairs: Array<{
    id: string;
    sectionId: string;
    sectionName: string;
    stemA: {
      id: string;
      sectionId: string;
      sectionName: string;
      categoryId: string | null;
      categoryName: string | null;
      stemText: unknown;
      isPrivate: boolean;
      setNames: string[];
      questions: Array<{
        id: string;
        question_text: unknown;
        answer_explanation: unknown;
        index: number;
        answer_options: Array<{
          answer_text?: unknown;
          answer_explanation: unknown;
          index?: number;
          is_answer: boolean | null;
        }>;
      }>;
    };
    stemB: {
      id: string;
      sectionId: string;
      sectionName: string;
      categoryId: string | null;
      categoryName: string | null;
      stemText: unknown;
      isPrivate: boolean;
      setNames: string[];
      questions: Array<{
        id: string;
        question_text: unknown;
        answer_explanation: unknown;
        index: number;
        answer_options: Array<{
          answer_text?: unknown;
          answer_explanation: unknown;
          index?: number;
          is_answer: boolean | null;
        }>;
      }>;
    };
    tokenRatio: number;
    trigramRatio: number;
    sharedTokenPreview: string[];
    recommendation: "merge" | "delete";
    suggestedMergeDirection: "A-into-B" | "B-into-A" | null;
  }> = [];

  const rowsBySection = new Map<string, StemDetailRow[]>();
  for (const row of rows) {
    const sectionId = row.section_id || "unknown";
    const list = rowsBySection.get(sectionId);
    if (list) list.push(row);
    else rowsBySection.set(sectionId, [row]);
  }

  for (const sectionRows of rowsBySection.values()) {
    const indexed = sectionRows
      .map((row) =>
        buildStemSimilarityIndexEntry(
          row.id,
          proseMirrorToPlainText(row.stem_text as Json) ?? "",
        ),
      )
      .filter((entry): entry is NonNullable<typeof entry> => entry != null);

    for (const pair of findPotentialDuplicatePairs(indexed)) {
      const stemARow = stemsById.get(pair.idA);
      const stemBRow = stemsById.get(pair.idB);
      if (!stemARow || !stemBRow) continue;
      const metaA = stemMetaById.get(pair.idA);
      const metaB = stemMetaById.get(pair.idB);
      const activeQuestions = (row: StemDetailRow) =>
        ((row.questions ?? []) as QuestionRow[])
          .filter((question) => !question.deleted_at)
          .map((question) => ({
            ...question,
            answer_options: (question.answer_options ?? []).filter(
              (option) => !option.deleted_at,
            ),
          }));
      const toSide = (row: StemDetailRow, meta: StemListMeta | undefined) => ({
        id: row.id,
        sectionId: row.section_id,
        sectionName: row.section_name ?? "",
        categoryId: row.question_stem_category_id,
        categoryName: row.category_name ?? null,
        stemText: row.stem_text,
        isPrivate: meta?.isPrivate ?? false,
        setNames: meta?.setNames ?? [],
        questions: activeQuestions(row).map((q) => ({
          id: q.id,
          question_text: q.question_text,
          answer_explanation: q.answer_explanation,
          index: q.index,
          answer_options: (q.answer_options ?? [])
            .filter((opt) => !opt.deleted_at)
            .map((opt) => ({
              answer_text: opt.answer_text,
              answer_explanation: opt.answer_explanation,
              index: opt.index,
              is_answer: opt.is_answer ?? null,
            })),
        })),
      });
      const isExactDuplicate = hasExactDuplicateContent(
        stemARow.stem_text,
        activeQuestions(stemARow),
        stemBRow.stem_text,
        activeQuestions(stemBRow),
      );
      potentialDuplicatePairs.push({
        id: `${pair.idA}:${pair.idB}`,
        sectionId: stemARow.section_id,
        sectionName: stemARow.section_name ?? "",
        stemA: toSide(stemARow, metaA),
        stemB: toSide(stemBRow, metaB),
        tokenRatio: pair.result.tokenRatio,
        trigramRatio: pair.result.trigramRatio,
        sharedTokenPreview: pair.result.sharedTokens,
        recommendation: isExactDuplicate ? "delete" : "merge",
        suggestedMergeDirection: isExactDuplicate
          ? null
          : suggestMergeDirection(stemARow.stem_text, stemBRow.stem_text),
      });
    }
  }

  potentialDuplicatePairs.sort((a, b) => {
    const scoreDiff =
      Math.max(b.tokenRatio, b.trigramRatio) -
      Math.max(a.tokenRatio, a.trigramRatio);
    if (scoreDiff !== 0) return scoreDiff;
    return a.sectionName.localeCompare(b.sectionName);
  });

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
    untaggedQuestions,
    privateStemsNotInSet,
    potentialDuplicatePairs,
    setsWithIncorrectQuestionCount,
    setsWithIncorrectTiming,
    setsWithMultipleSections,
    mocksWithIncorrectSets,
  });
}
