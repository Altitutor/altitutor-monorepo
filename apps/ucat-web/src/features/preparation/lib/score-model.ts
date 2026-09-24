import {
  estimateUcatSectionScore,
  resolveUcatScoringSection,
} from "@altitutor/ucat-marking";

export type ScoreEvidenceClassification =
  | "representative_full"
  | "representative_partial"
  | "learning_only";

export type RepresentativeScoreEvidence = {
  evidenceSessionId: string;
  source: "mock" | "set" | "practice";
  sectionId: string;
  sectionNumber: number;
  completedAt: string;
  marksAwarded: number;
  marksAvailable: number;
  questionCount: number;
  sectionQuestionCount: number;
  sectionCategoryCount: number;
  wasTimed: boolean;
  prescribedPace: number | null;
  breadth: "broad" | "mixed" | "narrow";
  categoryIds: string[];
  feedbackWithheld: boolean;
  isStudentGenerated: boolean;
};

export type RepresentativeSectionScore = {
  sectionId: string;
  sectionNumber: number;
  status: "available" | "unavailable";
  currentEstimate: number | null;
  plausibleRange: { min: number; max: number } | null;
  confidence: "low" | "medium" | "high" | null;
  uncertainty: number | null;
  qualifyingEvidenceCount: number;
  representativeMarksAwarded: number;
  representativeMarksAvailable: number;
  representativeSectionEquivalents: number;
};

export type RepresentativeScoreEstimate = {
  modelVersion: string;
  status: "available" | "unavailable";
  currentEstimate: number | null;
  plausibleRange: { min: number; max: number } | null;
  confidence: "low" | "medium" | "high" | null;
  uncertainty: number | null;
  sections: RepresentativeSectionScore[];
  situationalJudgement: RepresentativeSectionScore | null;
};

const DAY_MS = 86_400_000;
const RECENCY_HALF_LIFE_DAYS = 45;
const PRIOR_MARKS = 8;
const PRIOR_MEAN = 0.5;
const FULL_FORM_MARKS: Record<number, number> = { 1: 44, 2: 47, 3: 36, 4: 69 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function classifyScoreEvidence(
  evidence: RepresentativeScoreEvidence,
): ScoreEvidenceClassification {
  const pace = evidence.prescribedPace;
  const standardTiming =
    evidence.wasTimed && pace != null && Math.abs(pace - 1) < 0.001;
  const representativeConditions =
    standardTiming &&
    evidence.feedbackWithheld &&
    !evidence.isStudentGenerated;
  if (!representativeConditions) return "learning_only";

  const fullFormMarks = FULL_FORM_MARKS[evidence.sectionNumber];
  const equivalent =
    fullFormMarks && evidence.marksAvailable > 0
      ? evidence.marksAvailable / fullFormMarks
      : 0;
  if (evidence.source === "mock" || equivalent >= 0.9) {
    return "representative_full";
  }
  return equivalent > 0 ? "representative_partial" : "learning_only";
}

function recencyWeight(completedAt: string, now: number): number {
  const timestamp = new Date(completedAt).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  const ageDays = Math.max(0, (now - timestamp) / DAY_MS);
  return Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
}

function confidenceFor(equivalents: number, inconsistency: number) {
  if (equivalents >= 2 && inconsistency < 0.08) return "high" as const;
  if (equivalents >= 1 && inconsistency < 0.16) return "medium" as const;
  return "low" as const;
}

function estimateSection(
  sectionId: string,
  sectionNumber: number,
  evidence: RepresentativeScoreEvidence[],
  now: number,
): RepresentativeSectionScore {
  const qualifying = [
    ...new Map(
      evidence
        .filter((item) => classifyScoreEvidence(item) !== "learning_only")
        .map((item) => [item.evidenceSessionId, item]),
    ).values(),
  ];
  const pooledEquivalent = qualifying.reduce(
    (sum, item) => sum + item.marksAvailable / FULL_FORM_MARKS[item.sectionNumber]!,
    0,
  );
  const pooledCategories = new Set(
    qualifying.flatMap((item) => item.categoryIds),
  );
  const pooledBreadthIsRepresentative =
    qualifying.some(
      (item) => item.source === "mock" || item.breadth === "broad",
    ) ||
    pooledCategories.size >=
      Math.max(
        2,
        Math.ceil(
          Math.max(...qualifying.map((item) => item.sectionCategoryCount), 0) /
            2,
        ),
      );
  const totals = qualifying.reduce(
    (result, item) => {
      const weight = recencyWeight(item.completedAt, now);
      const equivalent =
        item.marksAvailable / FULL_FORM_MARKS[item.sectionNumber]!;
      const sessionAccuracy = clamp(
        item.marksAwarded / item.marksAvailable,
        0,
        1,
      );
      result.rawAwarded += item.marksAwarded;
      result.rawAvailable += item.marksAvailable;
      result.weightedAwarded += item.marksAwarded * weight;
      result.weightedAvailable += item.marksAvailable * weight;
      result.weightedEquivalents += equivalent * weight;
      result.rawEquivalents += equivalent;
      result.sessionWeights.push({ weight: equivalent * weight, accuracy: sessionAccuracy });
      return result;
    },
    {
      rawAwarded: 0,
      rawAvailable: 0,
      weightedAwarded: 0,
      weightedAvailable: 0,
      weightedEquivalents: 0,
      rawEquivalents: 0,
      sessionWeights: [] as Array<{ weight: number; accuracy: number }>,
    },
  );
  const unavailable = (): RepresentativeSectionScore => ({
    sectionId,
    sectionNumber,
    status: "unavailable",
    currentEstimate: null,
    plausibleRange: null,
    confidence: null,
    uncertainty: null,
    qualifyingEvidenceCount: qualifying.length,
    representativeMarksAwarded: totals.rawAwarded,
    representativeMarksAvailable: totals.rawAvailable,
    representativeSectionEquivalents: totals.weightedEquivalents,
  });
  if (pooledEquivalent < 0.5 || !pooledBreadthIsRepresentative) {
    return unavailable();
  }
  if (totals.rawEquivalents < 0.5 || totals.weightedAvailable <= 0) {
    return unavailable();
  }
  const scoringSection = resolveUcatScoringSection(sectionNumber);
  if (!scoringSection) return unavailable();

  const pooledAccuracy =
    (totals.weightedAwarded + PRIOR_MARKS * PRIOR_MEAN) /
    (totals.weightedAvailable + PRIOR_MARKS);
  const totalSessionWeight = totals.sessionWeights.reduce(
    (sum, item) => sum + item.weight,
    0,
  );
  const inconsistency =
    totalSessionWeight <= 0
      ? 0
      : Math.sqrt(
          totals.sessionWeights.reduce(
            (sum, item) =>
              sum + item.weight * Math.pow(item.accuracy - pooledAccuracy, 2),
            0,
          ) / totalSessionWeight,
        );
  const conversion = estimateUcatSectionScore({
    section: scoringSection,
    rawScore: pooledAccuracy * FULL_FORM_MARKS[sectionNumber]!,
    maxRawScore: FULL_FORM_MARKS[sectionNumber]!,
  });
  // Questions within one form are dependent. Grow precision by independent
  // section-equivalents rather than pretending every mark is independent.
  const independentSessionFactor =
    1 + 0.5 * Math.max(0, qualifying.length - 1);
  const dependenceAdjustedError =
    conversion.standardError /
    Math.sqrt(
      Math.max(0.5, totals.weightedEquivalents * independentSessionFactor),
    );
  const inconsistencyPenalty = inconsistency * 300;
  const uncertainty = Math.round(
    clamp(Math.sqrt(dependenceAdjustedError ** 2 + inconsistencyPenalty ** 2), 30, 150) /
      10,
  ) * 10;
  return {
    sectionId,
    sectionNumber,
    status: "available",
    currentEstimate: conversion.scaledScore,
    plausibleRange: {
      min: clamp(conversion.scaledScore - uncertainty, 300, 900),
      max: clamp(conversion.scaledScore + uncertainty, 300, 900),
    },
    confidence: confidenceFor(totals.weightedEquivalents, inconsistency),
    uncertainty,
    qualifyingEvidenceCount: qualifying.length,
    representativeMarksAwarded: totals.rawAwarded,
    representativeMarksAvailable: totals.rawAvailable,
    representativeSectionEquivalents: totals.weightedEquivalents,
  };
}

export function estimateRepresentativeScore(input: {
  now: string;
  modelVersion: string;
  evidence: RepresentativeScoreEvidence[];
}): RepresentativeScoreEstimate {
  const now = new Date(input.now).getTime();
  if (!Number.isFinite(now)) throw new Error("Score-model clock must be valid.");
  const sectionKeys = new Map<string, number>();
  for (const item of input.evidence) {
    if (!sectionKeys.has(item.sectionId)) {
      sectionKeys.set(item.sectionId, item.sectionNumber);
    }
  }
  const allSections = [...sectionKeys]
    .map(([sectionId, sectionNumber]) =>
      estimateSection(
        sectionId,
        sectionNumber,
        input.evidence.filter((item) => item.sectionId === sectionId),
        now,
      ),
    )
    .sort((left, right) => left.sectionNumber - right.sectionNumber);
  const sections = allSections.filter((section) => section.sectionNumber <= 3);
  const situationalJudgement =
    allSections.find((section) => section.sectionNumber === 4) ?? null;
  const available = sections.filter(
    (section): section is RepresentativeSectionScore & { currentEstimate: number; uncertainty: number } =>
      section.currentEstimate != null && section.uncertainty != null,
  );
  const complete =
    available.length === 3 &&
    new Set(available.map((section) => section.sectionNumber)).size === 3;
  const currentEstimate = complete
    ? available.reduce((sum, section) => sum + section.currentEstimate, 0)
    : null;
  const uncertainty = complete
    ? Math.round(
        Math.sqrt(
          available.reduce((sum, section) => sum + section.uncertainty ** 2, 0),
        ) / 10,
      ) * 10
    : null;
  const confidence = complete
    ? available.some((section) => section.confidence === "low")
      ? "low"
      : available.some((section) => section.confidence === "medium")
        ? "medium"
        : "high"
    : null;
  return {
    modelVersion: input.modelVersion,
    status: currentEstimate == null ? "unavailable" : "available",
    currentEstimate,
    plausibleRange:
      currentEstimate == null || uncertainty == null
        ? null
        : {
            min: clamp(currentEstimate - uncertainty, 900, 2700),
            max: clamp(currentEstimate + uncertainty, 900, 2700),
          },
    confidence,
    uncertainty,
    sections,
    situationalJudgement,
  };
}
