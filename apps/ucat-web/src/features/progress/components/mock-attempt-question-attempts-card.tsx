"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { SegmentedControl } from "@/features/progress/components/segmented-control";
import { UCAT_CARD_CHROME, UCAT_CARD_CONTENT_AFTER_HEADER, UCAT_CARD_HEADER_ROW } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import type { MockSetInfo } from "@/app/api/ucat/progress/mock-attempts/[id]/route";
import { ATTEMPT_CHART_RESULT_COLORS } from "../lib/attempt-chart-result-colors";
import { computeSetRanges } from "../lib/attempt-analysis-chart-layout";
import { computeQuestionAttemptResult } from "../lib/compute-question-attempt-result";
import {
  MockAttemptAnalysisChart,
  type MockQuestionAttemptForChart,
} from "./mock-attempt-analysis-chart";

type MockAttemptQuestionAttemptsCardProps = {
  chartData: MockQuestionAttemptForChart[];
  setBoundaryIndices: number[];
  sets: Pick<MockSetInfo, "questionSetName">[];
  selectedQuestionIndex: number;
  onBarClick: (index: number) => void;
};

type StemGroup = {
  stemIndex: number | null;
  questions: Array<MockQuestionAttemptForChart & { index: number }>;
};

type SectionGroup = {
  setIndex: number;
  name: string;
  stemGroups: StemGroup[];
};

function buildSectionGroups(
  chartData: MockQuestionAttemptForChart[],
  setBoundaryIndices: number[],
  sets: Pick<MockSetInfo, "questionSetName">[],
): SectionGroup[] {
  const setRanges = computeSetRanges(
    chartData.length,
    setBoundaryIndices,
    sets.map((s) => s.questionSetName),
  );

  return setRanges.map((range) => {
    const sectionQuestions = chartData
      .slice(range.startIndex, range.endIndex + 1)
      .map((question, offset) => ({
        ...question,
        index: range.startIndex + offset,
      }));

    const stemGroups = sectionQuestions.reduce<StemGroup[]>(
      (groups, question) => {
        const stemIndex = question.stemIndex ?? null;
        const last = groups[groups.length - 1];
        if (!last || last.stemIndex !== stemIndex) {
          groups.push({ stemIndex, questions: [question] });
        } else {
          last.questions.push(question);
        }
        return groups;
      },
      [],
    );

    return {
      setIndex: range.setIndex,
      name: range.name,
      stemGroups,
    };
  });
}

export function MockAttemptQuestionAttemptsCard({
  chartData,
  setBoundaryIndices,
  sets,
  selectedQuestionIndex,
  onBarClick,
}: MockAttemptQuestionAttemptsCardProps) {
  const [navigatorView, setNavigatorView] = useState<"simple" | "timing">(
    "simple",
  );

  const sectionGroups = useMemo(
    () => buildSectionGroups(chartData, setBoundaryIndices, sets),
    [chartData, setBoundaryIndices, sets],
  );

  return (
    <Card id="tour-attempt-navigator" className={cn(UCAT_CARD_CHROME, "min-w-0 overflow-hidden")}>
      <CardHeader className={UCAT_CARD_HEADER_ROW}>
        <CardTitle className="text-base font-medium">Question attempts</CardTitle>
        <SegmentedControl
          value={navigatorView}
          onValueChange={setNavigatorView}
          options={[
            { value: "simple", label: "Simple" },
            { value: "timing", label: "Timing graph" },
          ]}
        />
      </CardHeader>
      <CardContent className={cn("min-w-0 overflow-hidden", UCAT_CARD_CONTENT_AFTER_HEADER)}>
        {navigatorView === "timing" ? (
          <MockAttemptAnalysisChart
            data={chartData}
            setBoundaryIndices={setBoundaryIndices}
            sets={sets}
            selectedQuestionIndex={selectedQuestionIndex}
            onBarClick={onBarClick}
          />
        ) : (
          <div className="min-w-0 space-y-4 pb-1">
            {sectionGroups.map((section, sectionIndex) => (
              <div
                key={section.setIndex}
                className={cn(
                  sectionIndex > 0 && "border-t border-border pt-4",
                )}
              >
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  {section.name}
                </div>
                <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                  {section.stemGroups.map((group, groupIndex) => (
                    <div
                      key={`${section.setIndex}-${group.stemIndex ?? "none"}-${groupIndex}`}
                      className="flex flex-col items-center gap-1"
                    >
                      <div className="flex flex-wrap justify-center gap-1">
                        {group.questions.map((question) => {
                          const result =
                            question.score != null
                              ? computeQuestionAttemptResult({
                                  score: question.score,
                                  questionType: question.questionType ?? null,
                                  hasAttempt:
                                    question.result !== "not_attempted",
                                })
                              : question.result;
                          const selected =
                            question.index === selectedQuestionIndex;
                          const isNotAttempted = result === "not_attempted";
                          return (
                            <button
                              key={`${question.questionNumber}-${question.index}`}
                              type="button"
                              onClick={() => onBarClick(question.index)}
                              className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-md text-sm font-semibold tabular-nums transition",
                                selected
                                  ? "shadow-sm opacity-100"
                                  : "opacity-45",
                                isNotAttempted
                                  ? "bg-muted text-muted-foreground"
                                  : "text-white hover:ring-2 hover:ring-primary/30",
                              )}
                              style={
                                isNotAttempted
                                  ? undefined
                                  : {
                                      backgroundColor:
                                        ATTEMPT_CHART_RESULT_COLORS[result],
                                    }
                              }
                            >
                              {question.questionNumber}
                            </button>
                          );
                        })}
                      </div>
                      {group.stemIndex != null ? (
                        <span className="text-[10px] font-medium text-muted-foreground">
                          Stem {group.stemIndex}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
