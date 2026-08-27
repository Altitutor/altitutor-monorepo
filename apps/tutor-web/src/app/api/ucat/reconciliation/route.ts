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
  getOpenExplanationFeedback,
  getOpenQuestionFeedback,
} from "@/features/ucat/reconciliation/server/explanation-feedback";
import type {
  PrivateStemNotInSet,
  QuestionWithNoExplanation,
  StemInMultipleSets,
  StemWithNoCategory,
  UntaggedQuestion,
} from "@/features/ucat/reconciliation/api/reconciliation";

type ReconciliationContentIssues = {
  stemsWithNoCategory: StemWithNoCategory[];
  questionsWithNoExplanation: QuestionWithNoExplanation[];
  untaggedQuestions: UntaggedQuestion[];
  feedbackQuestions: QuestionWithNoExplanation[];
  privateStemsNotInSet: PrivateStemNotInSet[];
  stemsInMultipleSets: StemInMultipleSets[];
};

export async function GET() {
  const access = await requireUcatTutor();
  if (!access.ok) return access.response;

  const [
    sectionsResult,
    setsResult,
    mockDetailsResult,
    explanationFeedback,
    questionFeedback,
  ] = await Promise.all([
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
    getOpenExplanationFeedback(),
    getOpenQuestionFeedback(),
  ]);

  for (const result of [sectionsResult, setsResult, mockDetailsResult]) {
    if (result.error) {
      return captureApiErrorResponse(
        result.error,
        "/api/ucat/reconciliation",
        NextResponse.json({ error: result.error.message }, { status: 500 }),
      );
    }
  }

  const feedbackQuestionIds = [
    ...new Set(
      [...explanationFeedback, ...questionFeedback]
        .filter((feedback) => feedback.downvotes > 0)
        .map((feedback) => feedback.questionId),
    ),
  ];
  const contentIssuesResult = await access.userClient.rpc(
    "tutor_ucat_reconciliation_content_issues",
    { p_feedback_question_ids: feedbackQuestionIds },
  );
  if (contentIssuesResult.error) {
    return captureApiErrorResponse(
      contentIssuesResult.error,
      "/api/ucat/reconciliation",
      NextResponse.json(
        { error: contentIssuesResult.error.message },
        { status: 500 },
      ),
    );
  }

  const contentIssues =
    contentIssuesResult.data &&
    typeof contentIssuesResult.data === "object" &&
    !Array.isArray(contentIssuesResult.data)
      ? (contentIssuesResult.data as unknown as ReconciliationContentIssues)
      : {
          stemsWithNoCategory: [],
          questionsWithNoExplanation: [],
          untaggedQuestions: [],
          feedbackQuestions: [],
          privateStemsNotInSet: [],
          stemsInMultipleSets: [],
        };
  const feedbackQuestionById = new Map(
    contentIssues.feedbackQuestions.map((question) => [
      question.questionId,
      question,
    ]),
  );
  const downvotedExplanations = explanationFeedback
    .flatMap((feedback) => {
      if (feedback.downvotes === 0) return [];
      const question = feedbackQuestionById.get(feedback.questionId);
      return question ? [{ ...question, ...feedback }] : [];
    })
    .sort(
      (left, right) =>
        right.downvotes - left.downvotes ||
        right.latestAt.localeCompare(left.latestAt),
    );

  const downvotedQuestions = questionFeedback
    .flatMap((feedback) => {
      if (feedback.downvotes === 0) return [];
      const question = feedbackQuestionById.get(feedback.questionId);
      return question ? [{ ...question, ...feedback }] : [];
    })
    .sort(
      (left, right) =>
        right.downvotes - left.downvotes ||
        right.latestAt.localeCompare(left.latestAt),
    );

  const {
    stemsWithNoCategory,
    questionsWithNoExplanation,
    untaggedQuestions,
    privateStemsNotInSet,
    stemsInMultipleSets,
  } = contentIssues;

  // Potential duplicate stems have their own maintained, paginated queue so
  // unrelated reconciliation issue pages do not pay the matching cost.
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
