export type StemWithNoCategory = {
  id: string;
  sectionId: string;
  sectionName: string;
  stemText: unknown;
  questions: Array<{
    id: string;
    question_text: unknown;
    index: number;
    answer_options?: Array<{ answer_text?: unknown }>;
  }>;
};

export type QuestionWithNoExplanation = {
  stemId: string;
  stemText: unknown;
  sectionId: string;
  sectionName: string;
  questionId: string;
  questionText: unknown;
  questionIndex: number;
};

export type ContentFeedbackSummary = {
  questionId: string;
  upvotes: number;
  downvotes: number;
  reasonCounts: Record<string, number>;
  comments: Array<{
    reasonCode: string | null;
    text: string;
    createdAt: string;
  }>;
  latestAt: string;
};

export type ExplanationFeedbackSummary = ContentFeedbackSummary;
export type QuestionFeedbackSummary = ContentFeedbackSummary;
export type DownvotedExplanation = QuestionWithNoExplanation &
  ExplanationFeedbackSummary;
export type DownvotedQuestion = QuestionWithNoExplanation &
  QuestionFeedbackSummary;

export type UntaggedQuestion = {
  stemId: string;
  stemText: unknown;
  sectionId: string;
  sectionName: string;
  questionId: string;
  questionText: unknown;
  questionIndex: number;
  answerOptions?: Array<{ answer_text?: unknown }>;
};

export type PrivateStemNotInSet = {
  id: string;
  sectionId: string;
  sectionName: string;
  categoryId: string | null;
  categoryName: string | null;
  stemText: unknown;
  questions: Array<{
    id: string;
    question_text: unknown;
    index: number;
    answer_options?: Array<{ answer_text?: unknown }>;
  }>;
};

export type SetReconciliationRow = {
  id: string;
  name: string;
  sectionDisplay: string;
  stemCount: number;
  questionCount: number;
  timeLimitSeconds?: number | null;
  sectionCount: number;
  firstSectionNumber: number | null;
  questionCountStatus: "match" | "mismatch";
  questionCountTooltip: string;
  timeLimitStatus: "match" | "partial" | "mismatch" | "untimed";
  timeLimitTooltip: string;
};

export type MockWithIncorrectSets = {
  id: string;
  name: string;
  setCount: number;
  sets: Array<{ id: string; name: string }>;
};

export type PotentialDuplicateStemSide = {
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
    answer_explanation?: unknown;
    index: number;
    answer_options?: Array<{
      answer_text?: unknown;
      answer_explanation?: unknown;
      index?: number;
      is_answer?: boolean | null;
    }>;
  }>;
};

export type PotentialDuplicatePair = {
  id: string;
  sectionId: string;
  sectionName: string;
  stemA: PotentialDuplicateStemSide;
  stemB: PotentialDuplicateStemSide;
  tokenRatio: number;
  trigramRatio: number;
  sharedTokenPreview: string[];
  recommendation: "merge" | "delete";
  suggestedMergeDirection: "A-into-B" | "B-into-A" | null;
};

export type ReconciliationData = {
  stemsWithNoCategory: StemWithNoCategory[];
  questionsWithNoExplanation: QuestionWithNoExplanation[];
  downvotedQuestions: DownvotedQuestion[];
  downvotedExplanations: DownvotedExplanation[];
  untaggedQuestions: UntaggedQuestion[];
  privateStemsNotInSet: PrivateStemNotInSet[];
  potentialDuplicatePairs: PotentialDuplicatePair[];
  setsWithIncorrectQuestionCount: SetReconciliationRow[];
  setsWithIncorrectTiming: SetReconciliationRow[];
  setsWithMultipleSections: SetReconciliationRow[];
  mocksWithIncorrectSets: MockWithIncorrectSets[];
};

export async function fetchReconciliationData(): Promise<ReconciliationData> {
  const res = await fetch("/api/ucat/reconciliation");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body.error as string) ?? "Failed to fetch reconciliation data",
    );
  }
  return res.json();
}

export async function mergePotentialDuplicateStems(
  targetStemId: string,
  sourceStemId: string,
) {
  const res = await fetch("/api/ucat/reconciliation/merge-duplicates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetStemId, sourceStemId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body.error as string) ?? "Failed to merge question stems");
  }
  return res.json() as Promise<{
    ok: true;
    targetStemId: string;
    sourceStemId: string;
  }>;
}
