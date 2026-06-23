"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import type { MockSetInfo } from "@/app/api/ucat/progress/mock-attempts/[id]/route";
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

export function MockAttemptQuestionAttemptsCard({
  chartData,
  setBoundaryIndices,
  sets,
  selectedQuestionIndex,
  onBarClick,
}: MockAttemptQuestionAttemptsCardProps) {
  return (
    <Card className={cn(UCAT_CARD_CHROME, "min-w-0 overflow-hidden")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Question attempts</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 overflow-hidden">
        <MockAttemptAnalysisChart
          data={chartData}
          setBoundaryIndices={setBoundaryIndices}
          sets={sets}
          selectedQuestionIndex={selectedQuestionIndex}
          onBarClick={onBarClick}
        />
      </CardContent>
    </Card>
  );
}
