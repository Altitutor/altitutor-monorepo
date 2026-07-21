import {
  computeMaxRawScore,
  computeRawScore,
  estimateUcatSectionScore,
  resolveSingleUcatScoringSection,
  type QuestionMeta,
} from "@altitutor/ucat-marking";
import type { QuestionItem } from "@/features/question-engine/model/types";

export type MarkingRow = {
  question: QuestionItem;
  index: number;
  correctAnswerText: string;
  studentAnswerText: string;
  points: number;
};

export type MarkingResult = {
  rows: MarkingRow[];
  totalRawScore: number;
  maxRawScore: number;
  scaledScore: number | null;
  scaledScoreStandardError: number | null;
};

function buildQuestionMeta(questions: QuestionItem[]): QuestionMeta[] {
  return questions.map((question) => ({
    id: question.id,
    stemId: question.stemId,
    sectionName: question.sectionName,
    questionType: question.questionType,
    correctOptionId: question.correctOptionId ?? "",
    options: question.options.map((option) => ({
      id: option.id,
      index: option.index,
    })),
  }));
}

export function computeMarkingResult(
  questions: QuestionItem[],
  selectedAnswers: Record<string, string>,
  syllogismSnapshots?: Record<string, Record<string, boolean>>,
): MarkingResult {
  const questionMeta = buildQuestionMeta(questions);
  const nonSyllogismMeta = questionMeta.filter(
    (question) => question.questionType !== "syllogism",
  );
  const nonSyllogismIds = new Set(
    nonSyllogismMeta.map((question) => question.id),
  );
  const attempts = Object.entries(selectedAnswers)
    .filter(
      ([questionId]) =>
        nonSyllogismIds.has(questionId) && selectedAnswers[questionId],
    )
    .map(([questionId, selectedOptionId]) => ({
      questionId,
      selectedOptionId,
    }));

  const base = computeRawScore({ attempts, questions: nonSyllogismMeta });
  const questionScores = new Map(base.questionScores);

  for (const question of questions) {
    if (question.questionType !== "syllogism") continue;
    const snapshot = syllogismSnapshots?.[question.id];
    if (!snapshot) {
      questionScores.set(question.id, 0);
      continue;
    }

    let correctCount = 0;
    for (const option of [...question.options].sort(
      (left, right) => left.index - right.index,
    )) {
      const studentAnswer = snapshot[option.id];
      if (
        studentAnswer !== undefined &&
        studentAnswer === (option.isAnswer === true)
      ) {
        correctCount += 1;
      }
    }
    questionScores.set(
      question.id,
      correctCount >= 5 ? 2 : correctCount >= 3 ? 1 : 0,
    );
  }

  const totalRawScore = Array.from(questionScores.values()).reduce(
    (sum, score) => sum + score,
    0,
  );
  const maxRawScore = computeMaxRawScore(questionMeta);
  const scoringSection = resolveSingleUcatScoringSection(
    questionMeta.map((question) => question.sectionName),
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
