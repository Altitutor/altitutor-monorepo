export type ProjectionConfidence = "low" | "medium" | "high";

export type ProjectionScenario = "pessimistic" | "realistic" | "optimistic";

export type ProjectionPoint = {
  day: number;
  date: string;
  pessimistic: number;
  realistic: number;
  optimistic: number;
};

export type ProjectionHorizon = {
  day: number;
  pessimistic: number;
  realistic: number;
  optimistic: number;
};

export type SectionScoreProjection = {
  sectionId: string;
  sectionName: string;
  sectionNumber: number;
  currentEstimate: number;
  confidence: ProjectionConfidence;
  uncertainty: number;
  effectiveEvidenceWeight: number;
  evidenceCount: number;
  paceSource: "recent_activity" | "default";
  effectivePracticePerWeek: number;
  projection: ProjectionPoint[];
  horizons: ProjectionHorizon[];
};

export type ScoreProjectionResponse = {
  generatedAt: string;
  horizons: number[];
  sections: SectionScoreProjection[];
};
