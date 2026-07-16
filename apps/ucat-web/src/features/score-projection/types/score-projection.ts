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

export type HistoricalProjectionPoint = {
  date: string;
  value: number;
  confidence: ProjectionConfidence;
  uncertainty: number;
  effectiveEvidenceWeight: number;
};

export type ScoreProjectionSnapshot = {
  date: string;
  currentEstimate: number;
  confidence: ProjectionConfidence;
  uncertainty: number;
  effectiveEvidenceWeight: number;
  sectionEstimates: Record<string, number>;
};

export type SectionScoreProjection = {
  sectionId: string;
  sectionName: string;
  sectionNumber: number;
  currentEstimate: number | null;
  confidence: ProjectionConfidence;
  uncertainty: number;
  effectiveEvidenceWeight: number;
  evidenceCount: number;
  paceSource: "recent_activity" | "default";
  effectivePracticePerWeek: number;
  history: HistoricalProjectionPoint[];
  projection: ProjectionPoint[];
  horizons: ProjectionHorizon[];
};

export type ScoreProjectionResponse = {
  generatedAt: string;
  horizons: number[];
  sections: SectionScoreProjection[];
  snapshots: ScoreProjectionSnapshot[];
};

export type TotalScoreProjection = {
  currentEstimate: number | null;
  confidence: ProjectionConfidence | null;
  uncertainty: number | null;
  effectiveEvidenceWeight: number;
  missingSectionNumbers: number[];
  history: HistoricalProjectionPoint[];
  projection: ProjectionPoint[];
  horizons: ProjectionHorizon[];
};
