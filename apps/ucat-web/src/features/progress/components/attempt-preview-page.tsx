"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Card, CardContent, Slider } from "@altitutor/ui";
import type { CohortPercentileResult } from "@altitutor/ucat-percentiles";
import { Button } from "@/components/ui/button";
import type {
  QuestionEngineExam,
  QuestionItem,
} from "@/features/question-engine/model/types";
import { AttemptReviewSummaryGrid } from "./attempt-review-summary-grid";
import { MockAttemptQuestionAttemptsCard } from "./mock-attempt-question-attempts-card";
import { MockAttemptScoreTimingRow } from "./mock-attempt-score-timing-row";
import { SetAnswersCard } from "./set-answers-card";
import { AttemptInsightCard } from "./attempt-insight-card";
import type { QuestionAttemptForChart } from "./set-attempt-analysis-chart";
import type { CategoryBreakdownEntry } from "../lib/compute-category-breakdown";
import { buildAttemptOverallInsight } from "../lib/attempt-insights";

type AttemptPreviewKind = "practice" | "set" | "mock";
type TimingPattern = "consistent" | "improves" | "slows" | "spiky";

const ATTEMPT_OPTIONS: Array<{ value: AttemptPreviewKind; label: string }> = [
  { value: "practice", label: "Practice session" },
  { value: "set", label: "Set attempt" },
  { value: "mock", label: "Mock attempt" },
];

const TIMING_OPTIONS: Array<{ value: TimingPattern; label: string }> = [
  { value: "consistent", label: "Consistent" },
  { value: "improves", label: "Gets faster" },
  { value: "slows", label: "Gets slower" },
  { value: "spiky", label: "A few time spikes" },
];

const MOCK_SECTION_NAMES = [
  "Verbal Reasoning",
  "Decision Making",
  "Quantitative Reasoning",
  "Situational Judgement",
] as const;

function requestedAttempt(): AttemptPreviewKind {
  if (typeof window === "undefined") return "set";
  const value = new URLSearchParams(window.location.search).get("attempt");
  return ATTEMPT_OPTIONS.some((option) => option.value === value)
    ? (value as AttemptPreviewKind)
    : "set";
}

function resultForQuestion(index: number, accuracy: number) {
  const sample = (index * 37 + 19) % 100;
  if (sample < accuracy) return "correct" as const;
  if (sample > 96) return "not_attempted" as const;
  return "incorrect" as const;
}

function timeForQuestion(
  index: number,
  questionCount: number,
  averageSeconds: number,
  pattern: TimingPattern,
): number {
  const progress = questionCount <= 1 ? 0 : index / (questionCount - 1);
  const variation = ((index * 17) % 13) - 6;
  const patternOffset =
    pattern === "improves"
      ? 24 - progress * 48
      : pattern === "slows"
        ? -18 + progress * 42
        : pattern === "spiky" && (index + 1) % 7 === 0
          ? 62
          : 0;
  return Math.max(5, Math.round(averageSeconds + variation + patternOffset));
}

function buildChartData(input: {
  questionCount: number;
  accuracy: number;
  averageSeconds: number;
  timingPattern: TimingPattern;
}): QuestionAttemptForChart[] {
  return Array.from({ length: input.questionCount }, (_, index) => {
    const result = resultForQuestion(index, input.accuracy);
    return {
      questionNumber: index + 1,
      stemIndex: Math.floor(index / 4) + 1,
      timeSpentSeconds: timeForQuestion(
        index,
        input.questionCount,
        input.averageSeconds,
        input.timingPattern,
      ),
      result,
      score: result === "correct" ? 1 : 0,
      questionType: "multiple_choice",
    };
  });
}

type PreviewQuestionAttempt = {
  questionNumber: number;
  questionId: string;
  questionAnswerOptionId: string | null;
  result: "correct" | "partial" | "incorrect" | "not_attempted";
  score: number;
  timeSpentSeconds: number | null;
  averageTimeSeconds: number;
  averageTimeSampleSize: number;
  timeBurdenSeconds: number;
  difficulty: number;
  questionTags: Array<{ name: string; description: string }>;
  categoryName: string;
  categoryDescription: string;
  isFlagged: boolean;
};

function buildReviewContent(
  chartData: QuestionAttemptForChart[],
  attempt: AttemptPreviewKind,
  averageSeconds: number,
): { exam: QuestionEngineExam; questionAttempts: PreviewQuestionAttempt[] } {
  const questions: QuestionItem[] = chartData.map((question, index) => {
    const sectionIndex =
      attempt === "mock"
        ? Math.min(
            MOCK_SECTION_NAMES.length - 1,
            Math.floor((index / chartData.length) * MOCK_SECTION_NAMES.length),
          )
        : 0;
    const sectionName = MOCK_SECTION_NAMES[sectionIndex];
    const stemNumber = Math.floor(index / 4) + 1;
    const correctOptionIndex = (stemNumber + index) % 4;
    const optionTexts = [
      "The evidence directly supports this conclusion.",
      "The conclusion is plausible but requires an extra assumption.",
      "The information given is insufficient to decide.",
      "The conclusion conflicts with an explicit detail in the passage.",
    ];
    const options = optionTexts.map((text, optionIndex) => ({
      id: `preview-question-${index}-option-${optionIndex}`,
      index: optionIndex,
      text,
      isAnswer: optionIndex === correctOptionIndex,
      answerExplanation:
        optionIndex === correctOptionIndex
          ? "This is the best answer because it follows from the stated evidence without introducing a new assumption."
          : "This option is not the best answer because it either goes beyond the evidence or contradicts a stated detail.",
      selectionCount: [42, 31, 19, 8][optionIndex],
      totalAnswered: 100,
      percentage: [42, 31, 19, 8][optionIndex],
    }));

    return {
      id: `preview-question-${index}`,
      index,
      questionSetId: `preview-${attempt}-set`,
      stemId: `preview-stem-${stemNumber}`,
      sectionName,
      sectionDisplayColumns: 1,
      stemText: `Placeholder stem ${stemNumber}\n\nA group of candidates completed a structured UCAT preparation programme. Students who reviewed mistakes within 24 hours generally improved more consistently, while the amount of practice alone did not reliably predict improvement. This placeholder passage is intentionally long enough to preview realistic wrapping and spacing in the review UI.`,
      questionText:
        index % 3 === 0
          ? "Which conclusion is best supported by the information in the passage?"
          : index % 3 === 1
            ? "Which statement most accurately reflects the relationship described?"
            : "Based only on the information provided, which option should be selected?",
      questionType: "multiple_choice",
      options,
      correctOptionId: options[correctOptionIndex]?.id,
      answerExplanation: `The key is to use only the evidence provided in placeholder stem ${stemNumber}. The correct option preserves the distinction between an observed association and a guaranteed cause. The other options either overstate the conclusion, introduce information that was not supplied, or contradict the passage.`,
    };
  });

  const questionAttempts = chartData.map((question, index) => {
    const currentQuestion = questions[index]!;
    const correctOptionIndex = currentQuestion.options.findIndex(
      (option) => option.isAnswer,
    );
    const selectedOptionIndex =
      question.result === "correct"
        ? correctOptionIndex
        : question.result === "not_attempted"
          ? -1
          : (correctOptionIndex + 1) % currentQuestion.options.length;
    const timeSpentSeconds = question.timeSpentSeconds ?? averageSeconds;
    const categoryIndex = Math.floor(index / 4) % 2;
    return {
      questionNumber: index + 1,
      questionId: currentQuestion.id,
      questionAnswerOptionId:
        selectedOptionIndex < 0
          ? null
          : (currentQuestion.options[selectedOptionIndex]?.id ?? null),
      result: question.result,
      score: question.score ?? 0,
      timeSpentSeconds,
      averageTimeSeconds: averageSeconds,
      averageTimeSampleSize: 126,
      timeBurdenSeconds: Math.max(0, timeSpentSeconds - averageSeconds),
      difficulty: 2 + ((index * 3) % 8),
      questionTags: [
        {
          name: index % 2 === 0 ? "Inference" : "Evidence",
          description:
            "Placeholder skill tag used to preview question metadata.",
        },
        {
          name: index % 3 === 0 ? "Review priority" : "Core skill",
          description:
            "Placeholder study-priority tag used in the attempt lab.",
        },
      ],
      categoryName: categoryIndex === 0 ? "Category A" : "Category B",
      categoryDescription:
        categoryIndex === 0
          ? "Placeholder category covering interpretation and inference."
          : "Placeholder category covering evidence and conclusion matching.",
      isFlagged: (index + 1) % 9 === 0,
    };
  });

  return {
    exam: {
      sourceType:
        attempt === "practice"
          ? "questionStem"
          : attempt === "mock"
            ? "mock"
            : "set",
      sourceId: `preview-${attempt}`,
      title: `${ATTEMPT_OPTIONS.find((option) => option.value === attempt)?.label} preview`,
      questions,
      instructionsScreens: [],
    },
    questionAttempts,
  };
}

function buildCategoryBreakdown(
  chartData: QuestionAttemptForChart[],
): CategoryBreakdownEntry[] {
  const split = Math.ceil(chartData.length / 2);
  return [
    { name: "Category A", questions: chartData.slice(0, split) },
    { name: "Category B", questions: chartData.slice(split) },
  ].map(({ name, questions }) => ({
    name,
    score: questions.reduce((total, question) => total + (question.score ?? 0), 0),
    total: questions.length,
  }));
}

function buildPercentile(
  score: number,
  scope: "set" | "mock",
): CohortPercentileResult {
  const minimumScore = scope === "mock" ? 900 : 300;
  const scoreRange = scope === "mock" ? 1800 : 600;
  const percentile = Math.max(
    1,
    Math.min(99, Math.round(((score - minimumScore) / scoreRange) * 100)),
  );
  return {
    status: "available",
    percentile,
    targetScore: score,
    cohortSize: 184,
    minimumCohortSize: 20,
    bins: Array.from({ length: 13 }, (_, index) => ({
      score: minimumScore + index * (scoreRange / 12),
      count: Math.max(2, 30 - Math.abs(index - 6) * 4),
    })),
  };
}

function updatePreviewUrl(attempt: AttemptPreviewKind) {
  window.history.replaceState(null, "", `/progress/attempts/preview?attempt=${attempt}`);
}

export function AttemptPreviewPage() {
  const [attempt, setAttempt] = useState<AttemptPreviewKind>(requestedAttempt);
  const [questionCount, setQuestionCount] = useState(32);
  const [accuracy, setAccuracy] = useState(68);
  const [averageSeconds, setAverageSeconds] = useState(54);
  const [timingPattern, setTimingPattern] =
    useState<TimingPattern>("consistent");
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const model = useMemo(() => {
    const chartData = buildChartData({
      questionCount,
      accuracy,
      averageSeconds,
      timingPattern,
    });
    const points = chartData.reduce(
      (total, question) => total + (question.score ?? 0),
      0,
    );
    const totalTimeSeconds = chartData.reduce(
      (total, question) => total + (question.timeSpentSeconds ?? 0),
      0,
    );
    const scaledScore = Math.round(300 + (points / questionCount) * 600);
    const sectionSize = Math.ceil(questionCount / MOCK_SECTION_NAMES.length);
    const setBoundaryIndices = MOCK_SECTION_NAMES.slice(0, -1)
      .map((_, index) => Math.min(questionCount - 1, (index + 1) * sectionSize - 1))
      .filter((boundary, index, boundaries) =>
        boundary < questionCount - 1 && boundaries.indexOf(boundary) === index,
      );
    const reviewContent = buildReviewContent(
      chartData,
      attempt,
      averageSeconds,
    );
    return {
      chartData,
      points,
      totalTimeSeconds,
      scaledScore,
      categoryBreakdown: buildCategoryBreakdown(chartData),
      setPercentile: buildPercentile(scaledScore, "set"),
      mockPercentile: buildPercentile(scaledScore * 3, "mock"),
      setBoundaryIndices,
      mockSets: MOCK_SECTION_NAMES.slice(0, setBoundaryIndices.length + 1).map(
        (questionSetName) => ({ questionSetName }),
      ),
      ...reviewContent,
    };
  }, [accuracy, attempt, averageSeconds, questionCount, timingPattern]);

  const timing = {
    timeTakenSeconds: model.totalTimeSeconds,
    setTimeLimitSeconds: questionCount * 60,
    examTimeLimitSeconds: questionCount * 55,
    studentSetSpeed: (questionCount * 60) / model.totalTimeSeconds,
    studentExamSpeed: (questionCount * 55) / model.totalTimeSeconds,
  };
  const overallInsight = buildAttemptOverallInsight({
    accuracyPercent:
      questionCount > 0 ? (model.points / questionCount) * 100 : null,
    examPacePercent:
      attempt === "practice" ? null : timing.studentExamSpeed * 100,
    averageTimePerQuestionSeconds:
      attempt === "practice" ? model.totalTimeSeconds / questionCount : null,
    recentPerformance: null,
  });

  return (
    <div className="space-y-6 pb-8">
      <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="secondary">Development preview</Badge>
            <h1 className="mt-2 text-2xl font-semibold">Attempt state lab</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Adjust the evidence below to inspect the real attempt graph at
              different lengths, accuracy levels, and timing patterns.
            </p>
          </div>
          <label className="text-sm font-medium">
            Attempt type
            <select
              value={attempt}
              onChange={(event) => {
                const nextAttempt = event.target.value as AttemptPreviewKind;
                setAttempt(nextAttempt);
                setSelectedQuestionIndex(0);
                updatePreviewUrl(nextAttempt);
              }}
              className="mt-1 block min-w-56 rounded-lg border bg-background px-3 py-2 text-sm"
            >
              {ATTEMPT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <Card className="mt-5">
          <CardContent className="grid gap-5 pt-6 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-medium">
              Questions
              <select
                value={questionCount}
                onChange={(event) => {
                  setQuestionCount(Number(event.target.value));
                  setSelectedQuestionIndex(0);
                }}
                className="mt-2 block w-full rounded-lg border bg-background px-3 py-2 text-sm"
              >
                {[12, 24, 32, 40, 80].map((count) => (
                  <option key={count} value={count}>{count}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              <span className="flex justify-between gap-3">
                <span>Accuracy</span><span>{accuracy}%</span>
              </span>
              <Slider
                className="mt-4"
                min={10}
                max={100}
                step={1}
                value={[accuracy]}
                onValueChange={([value]) => setAccuracy(value ?? accuracy)}
                aria-label="Accuracy percentage"
              />
            </label>
            <label className="text-sm font-medium">
              <span className="flex justify-between gap-3">
                <span>Average time</span><span>{averageSeconds}s</span>
              </span>
              <Slider
                className="mt-4"
                min={10}
                max={150}
                step={1}
                value={[averageSeconds]}
                onValueChange={([value]) =>
                  setAverageSeconds(value ?? averageSeconds)
                }
                aria-label="Average seconds per question"
              />
            </label>
            <label className="text-sm font-medium">
              Timing pattern
              <select
                value={timingPattern}
                onChange={(event) =>
                  setTimingPattern(event.target.value as TimingPattern)
                }
                className="mt-2 block w-full rounded-lg border bg-background px-3 py-2 text-sm"
              >
                {TIMING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </CardContent>
        </Card>
      </div>

      <div className="mx-auto w-full max-w-[1400px] space-y-4 px-5 sm:px-6">
        <div>
          <h2 className="text-xl font-semibold">
            {ATTEMPT_OPTIONS.find((option) => option.value === attempt)?.label}
          </h2>
          <p className="text-sm text-muted-foreground">
            Preview result: {model.points} / {questionCount} · selected question {selectedQuestionIndex + 1}
          </p>
        </div>

        <AttemptInsightCard label="Overall insight" insight={overallInsight} />

        {attempt === "mock" ? (
          <>
            <MockAttemptScoreTimingRow
              scaledScore={model.scaledScore * 3}
              percentile={model.mockPercentile}
              timing={timing}
            />
            <MockAttemptQuestionAttemptsCard
              chartData={model.chartData}
              setBoundaryIndices={model.setBoundaryIndices}
              sets={model.mockSets}
              selectedQuestionIndex={selectedQuestionIndex}
              onBarClick={setSelectedQuestionIndex}
            />
          </>
        ) : (
          <AttemptReviewSummaryGrid
            points={model.points}
            total={questionCount}
            scaledScore={attempt === "set" ? model.scaledScore : undefined}
            percentile={attempt === "set" ? model.setPercentile : undefined}
            categoryBreakdown={model.categoryBreakdown}
            chartData={model.chartData}
            selectedQuestionIndex={selectedQuestionIndex}
            onBarClick={setSelectedQuestionIndex}
            timing={attempt === "set" ? timing : undefined}
            practiceTiming={
              attempt === "practice"
                ? {
                    sessionTimeSeconds: model.totalTimeSeconds,
                    averageTimePerQuestionSeconds:
                      model.totalTimeSeconds / questionCount,
                  }
                : undefined
            }
          />
        )}

        <div id="attempt-review-questions" className="pt-2">
          <SetAnswersCard
            questionAttempts={model.questionAttempts}
            exam={model.exam}
            initialQuestionIndex={selectedQuestionIndex}
            onQuestionIndexChange={setSelectedQuestionIndex}
            attemptReview
          />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1400px] flex-wrap gap-3 px-5 sm:px-6">
        <Button asChild variant="outline">
          <Link href="/progress/preview">Open progress state lab</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/dashboard/preview">Open dashboard state lab</Link>
        </Button>
      </div>
    </div>
  );
}
