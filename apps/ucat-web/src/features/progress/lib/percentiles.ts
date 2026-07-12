type PercentileAnchor = {
  score: number;
  percentile: number;
};

const SECTION_ANCHORS: PercentileAnchor[] = [
  { score: 300, percentile: 1 },
  { score: 420, percentile: 10 },
  { score: 500, percentile: 20 },
  { score: 560, percentile: 35 },
  { score: 600, percentile: 50 },
  { score: 640, percentile: 65 },
  { score: 700, percentile: 80 },
  { score: 760, percentile: 90 },
  { score: 830, percentile: 97 },
  { score: 900, percentile: 99 },
];

const MOCK_ANCHORS: PercentileAnchor[] = SECTION_ANCHORS.map((anchor) => ({
  score: anchor.score * 3,
  percentile: anchor.percentile,
}));

export type UcatPercentileScope = "section" | "mock";

export function getUcatScoreRange(scope: UcatPercentileScope) {
  return scope === "mock"
    ? {
        min: MOCK_ANCHORS[0].score,
        max: MOCK_ANCHORS[MOCK_ANCHORS.length - 1].score,
      }
    : {
        min: SECTION_ANCHORS[0].score,
        max: SECTION_ANCHORS[SECTION_ANCHORS.length - 1].score,
      };
}

function interpolatePercentile(
  score: number,
  anchors: PercentileAnchor[],
): number {
  if (score <= anchors[0].score) return anchors[0].percentile;
  const last = anchors[anchors.length - 1];
  if (score >= last.score) return last.percentile;

  for (let i = 1; i < anchors.length; i += 1) {
    const upper = anchors[i];
    const lower = anchors[i - 1];
    if (score <= upper.score) {
      const progress = (score - lower.score) / (upper.score - lower.score);
      return (
        lower.percentile + progress * (upper.percentile - lower.percentile)
      );
    }
  }

  return last.percentile;
}

function ordinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

export function formatUcatPercentile(
  scaledScore: number | null | undefined,
  scope: UcatPercentileScope,
): string | null {
  const percentile = getUcatPercentile(scaledScore, scope);
  if (percentile == null) return null;
  return percentile < 20
    ? "<20th percentile"
    : `${ordinal(percentile)} percentile`;
}

export function getUcatPercentile(
  scaledScore: number | null | undefined,
  scope: UcatPercentileScope,
): number | null {
  if (scaledScore == null || !Number.isFinite(scaledScore)) return null;
  const percentile = Math.min(
    99,
    Math.round(
      interpolatePercentile(
        scaledScore,
        scope === "mock" ? MOCK_ANCHORS : SECTION_ANCHORS,
      ),
    ),
  );
  return percentile;
}
