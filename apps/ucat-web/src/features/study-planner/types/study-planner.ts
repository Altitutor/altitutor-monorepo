import type { TrajectoryStatus, ProjectionWarning } from "@/features/study-planner/lib/constants";
import type { ProjectionBand } from "@/features/study-planner/lib/score-projection";

export type StudyPlannerSettings = {
  testYear: number | null;
  testDate: string | null;
  targetScores: {
    s1: number | null;
    s2: number | null;
    s3: number | null;
  };
};

export type ProjectionConfidence = "low" | "medium" | "high";

export type SectionProjectionResponse = {
  sectionId: string;
  sectionName: string;
  sectionNumber: number;
  sHat: number;
  uncertainty: number;
  sInf: number;
  observationCount: number;
  isPriorPhase: boolean;
  confidence: ProjectionConfidence;
  warnings: ProjectionWarning[];
  projection: ProjectionBand[];
  target?: {
    score: number;
    rNeeded: number;
    ceilingWarning: boolean;
    paceWarning: boolean;
    trajectoryStatus: TrajectoryStatus;
  };
};

export type StudyPlannerProjectionResponse = {
  sections: SectionProjectionResponse[];
  testDate: string | null;
};
