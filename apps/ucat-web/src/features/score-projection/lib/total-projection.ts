import type {
  HistoricalProjectionPoint,
  ProjectionConfidence,
  ProjectionHorizon,
  ProjectionPoint,
  SectionScoreProjection,
  TotalScoreProjection,
} from "@/features/score-projection/types/score-projection";

const COGNITIVE_SECTION_NUMBERS = [1, 2, 3] as const;

const CONFIDENCE_RANK: Record<ProjectionConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function lowestConfidence(
  projections: SectionScoreProjection[],
): ProjectionConfidence {
  return projections.reduce<ProjectionConfidence>(
    (lowest, projection) =>
      CONFIDENCE_RANK[projection.confidence] < CONFIDENCE_RANK[lowest]
        ? projection.confidence
        : lowest,
    "high",
  );
}

function sumProjectionPoints(
  sections: SectionScoreProjection[],
): ProjectionPoint[] {
  const days = new Set<number>();
  for (const section of sections) {
    for (const point of section.projection) days.add(point.day);
  }

  return [...days]
    .sort((a, b) => a - b)
    .flatMap((day) => {
      const points = sections.map((section) =>
        section.projection.find((point) => point.day === day),
      );
      if (points.some((point) => point == null)) return [];
      const first = points[0]!;
      return [
        {
          day,
          date: first.date,
          pessimistic: points.reduce(
            (sum, point) => sum + point!.pessimistic,
            0,
          ),
          realistic: points.reduce((sum, point) => sum + point!.realistic, 0),
          optimistic: points.reduce((sum, point) => sum + point!.optimistic, 0),
        },
      ];
    });
}

function sumHorizons(sections: SectionScoreProjection[]): ProjectionHorizon[] {
  const days = new Set<number>();
  for (const section of sections) {
    for (const horizon of section.horizons) days.add(horizon.day);
  }

  return [...days]
    .sort((a, b) => a - b)
    .flatMap((day) => {
      const horizons = sections.map((section) =>
        section.horizons.find((horizon) => horizon.day === day),
      );
      if (horizons.some((horizon) => horizon == null)) return [];
      return [
        {
          day,
          pessimistic: horizons.reduce(
            (sum, horizon) => sum + horizon!.pessimistic,
            0,
          ),
          realistic: horizons.reduce(
            (sum, horizon) => sum + horizon!.realistic,
            0,
          ),
          optimistic: horizons.reduce(
            (sum, horizon) => sum + horizon!.optimistic,
            0,
          ),
        },
      ];
    });
}

function latestHistoryOnOrBefore(
  section: SectionScoreProjection,
  date: string,
): HistoricalProjectionPoint | null {
  let best: HistoricalProjectionPoint | null = null;
  for (const point of section.history) {
    if (point.date > date) continue;
    if (best == null || point.date >= best.date) best = point;
  }
  return best;
}

function sumHistory(
  sections: SectionScoreProjection[],
): HistoricalProjectionPoint[] {
  // Total history only exists once every cognitive section has an estimate.
  // Section histories can start on different weeks, so require an exact-date
  // intersection drops almost everything — carry each section's latest known
  // estimate forward across the shared date union instead.
  const firstDates = sections.map((section) => section.history[0]?.date ?? null);
  if (firstDates.some((date) => date == null)) return [];
  const totalAvailableFrom = firstDates.sort().at(-1)!;

  const dates = new Set<string>();
  for (const section of sections) {
    for (const point of section.history) {
      if (point.date >= totalAvailableFrom) dates.add(point.date);
    }
  }

  return [...dates]
    .sort((a, b) => a.localeCompare(b))
    .flatMap((date) => {
      const points = sections.map((section) =>
        latestHistoryOnOrBefore(section, date),
      );
      if (points.some((point) => point == null)) return [];
      const confidence = lowestConfidence(
        sections.map((section, index) => ({
          ...section,
          confidence: points[index]!.confidence,
        })),
      );
      return [
        {
          date,
          value: points.reduce((sum, point) => sum + point!.value, 0),
          confidence,
          uncertainty: Math.round(
            Math.sqrt(
              points.reduce(
                (sum, point) => sum + Math.pow(point!.uncertainty, 2),
                0,
              ),
            ),
          ),
          effectiveEvidenceWeight: points.reduce(
            (sum, point) => sum + point!.effectiveEvidenceWeight,
            0,
          ),
        },
      ];
    });
}

export function deriveTotalScoreProjection(
  sections: SectionScoreProjection[],
): TotalScoreProjection {
  const bySectionNumber = new Map(
    sections.map((section) => [section.sectionNumber, section]),
  );
  const cognitiveSections = COGNITIVE_SECTION_NUMBERS.flatMap(
    (sectionNumber) => {
      const section = bySectionNumber.get(sectionNumber);
      return section ? [section] : [];
    },
  );
  const missingSectionNumbers = COGNITIVE_SECTION_NUMBERS.filter(
    (sectionNumber) => {
      const section = bySectionNumber.get(sectionNumber);
      return !section || section.currentEstimate == null;
    },
  );
  const effectiveEvidenceWeight = cognitiveSections.reduce(
    (sum, section) => sum + section.effectiveEvidenceWeight,
    0,
  );

  if (missingSectionNumbers.length > 0) {
    return {
      currentEstimate: null,
      confidence: null,
      uncertainty: null,
      effectiveEvidenceWeight,
      missingSectionNumbers,
      history: [],
      projection: [],
      horizons: [],
    };
  }

  return {
    currentEstimate: cognitiveSections.reduce(
      (sum, section) => sum + (section.currentEstimate ?? 0),
      0,
    ),
    confidence: lowestConfidence(cognitiveSections),
    uncertainty: Math.round(
      Math.sqrt(
        cognitiveSections.reduce(
          (sum, section) => sum + Math.pow(section.uncertainty, 2),
          0,
        ),
      ),
    ),
    effectiveEvidenceWeight,
    missingSectionNumbers: [],
    history: sumHistory(cognitiveSections),
    projection: sumProjectionPoints(cognitiveSections),
    horizons: sumHorizons(cognitiveSections),
  };
}
