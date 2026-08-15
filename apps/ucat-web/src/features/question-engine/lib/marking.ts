import {
  computeRawScore,
  estimateUcatSectionScore,
  resolveSingleUcatScoringSection,
  type ScoringQuestion,
} from "@altitutor/ucat-marking";
import type { PlacementSnapshot, QuestionItem } from "@/features/question-engine/model/types";
import type { ReviewContract } from "@altitutor/ucat-response-contract";
import {
  responseDefinitionForQuestion,
  snapshotQuestionResponse,
} from "@/features/question-engine/lib/response-state";

export type MarkingRow = {
  question: QuestionItem;
  index: number;
  correctAnswerText: string;
  studentAnswerText: string;
  points: number;
  review: ReviewContract;
};

export type MarkingResult = {
  rows: MarkingRow[];
  totalRawScore: number;
  maxRawScore: number;
  scaledScore: number | null;
  scaledScoreStandardError: number | null;
};

function buildScoringQuestions(questions: QuestionItem[]): ScoringQuestion[] {
  return questions.map((question) => ({
    definition: responseDefinitionForQuestion(question),
    sectionName: question.sectionName,
  }));
}

export function computeMarkingResult(
  questions: QuestionItem[],
  selectedAnswers: Record<string, string>,
  placementSnapshots?: Record<string, PlacementSnapshot>,
): MarkingResult {
  const scoringQuestions = buildScoringQuestions(questions);
  const responses = new Map(
    questions.map((question) => [
      question.id,
      snapshotQuestionResponse(
        question,
        selectedAnswers[question.id],
        placementSnapshots?.[question.id],
      ).response,
    ]),
  );
  const scored = computeRawScore({ responses, questions: scoringQuestions });
  const { questionScores, totalRawScore } = scored;
  const maxRawScore = scored.maximumRawScore;
  const scoringSection = resolveSingleUcatScoringSection(
    scoringQuestions.map((question) => question.sectionName),
  );
  const scoreEstimate =
    maxRawScore > 0 && scoringSection
      ? estimateUcatSectionScore({
          section: scoringSection,
          rawScore: totalRawScore,
          maxRawScore,
        })
      : null;

  const rows = questions.map((question, index): MarkingRow => {
    const optionTextById = new Map(
      question.options.map((option) => [option.id, option.text]),
    );
    const selectedId = selectedAnswers[question.id];
    return {
      question,
      index,
      correctAnswerText: question.correctOptionId
        ? (optionTextById.get(question.correctOptionId) ?? "—")
        : "—",
      studentAnswerText: selectedId
        ? (optionTextById.get(selectedId) ?? "—")
        : "—",
      points: questionScores.get(question.id) ?? 0,
      review: scored.reviews.get(question.id)!,
    };
  });

  return {
    rows,
    totalRawScore,
    maxRawScore,
    scaledScore: scoreEstimate?.scaledScore ?? null,
    scaledScoreStandardError: scoreEstimate?.standardError ?? null,
  };
}
