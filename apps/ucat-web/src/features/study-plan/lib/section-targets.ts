export type SectionTargetEvidence = {
  sectionId: string;
  currentEstimate: number | null;
  confidence?: "low" | "medium" | "high" | null;
};

export type AllocateSectionTargetsInput = {
  totalTarget: number;
  sections: SectionTargetEvidence[];
  previousTargets?: Record<string, number>;
  previousTargetsSetAt?: string | null;
  now?: string;
};

const TARGET_STEP = 10;
const MIN_SECTION_TARGET = 300;
const MAX_SECTION_TARGET = 900;
const WEEK_MS = 7 * 86_400_000;
const MAX_WEEKLY_MOVEMENT = 20;

const CONFIDENCE_WEIGHT = {
  low: 0.25,
  medium: 0.6,
  high: 1,
} as const;

function distributeTotal(total: number, count: number): number[] {
  const base = Math.floor(total / count / TARGET_STEP) * TARGET_STEP;
  const result = Array.from({ length: count }, () => base);
  let remaining = total - base * count;
  let cursor = result.length - 1;
  while (remaining >= TARGET_STEP && cursor >= 0) {
    result[cursor]! += TARGET_STEP;
    remaining -= TARGET_STEP;
    cursor -= 1;
  }
  return result;
}

function rebalanceToTotal(
  values: number[],
  total: number,
  minimums: number[],
  maximums: number[],
): number[] {
  const result = [...values];
  let difference = total - result.reduce((sum, value) => sum + value, 0);
  let cursor = result.length - 1;
  let attempts = 0;
  while (difference !== 0 && attempts < 500) {
    const index = ((cursor % result.length) + result.length) % result.length;
    const step =
      Math.sign(difference) * Math.min(TARGET_STEP, Math.abs(difference));
    const next = result[index]! + step;
    if (next >= minimums[index]! && next <= maximums[index]!) {
      result[index] = next;
      difference -= step;
    }
    cursor -= 1;
    attempts += 1;
  }
  return result;
}

function withinWeeklyHold(input: AllocateSectionTargetsInput): boolean {
  if (!input.previousTargetsSetAt || !input.now) return false;
  const previous = new Date(input.previousTargetsSetAt).getTime();
  const now = new Date(input.now).getTime();
  return (
    Number.isFinite(previous) &&
    Number.isFinite(now) &&
    now - previous < WEEK_MS
  );
}

/**
 * Canonical cognitive working-target policy. Initial targets are equal; later
 * weekly replans use confidence-discounted estimates with hysteresis and a
 * bounded move while preserving the Student's saved total target.
 */
export function allocateSectionTargets(
  input: AllocateSectionTargetsInput,
): Record<string, number>;
/** @deprecated Callers with persisted preparation state should use the object interface. */
export function allocateSectionTargets(
  totalTarget: number,
  sections: SectionTargetEvidence[],
): Record<string, number>;
export function allocateSectionTargets(
  inputOrTarget: AllocateSectionTargetsInput | number,
  legacySections: SectionTargetEvidence[] = [],
): Record<string, number> {
  const input: AllocateSectionTargetsInput =
    typeof inputOrTarget === "number"
      ? { totalTarget: inputOrTarget, sections: legacySections }
      : inputOrTarget;
  const cognitive = input.sections.slice(0, 3);
  if (!cognitive.length) return {};
  const initial = distributeTotal(input.totalTarget, cognitive.length);
  const previous = cognitive.map(
    (section) => input.previousTargets?.[section.sectionId],
  );
  const hasCompletePrevious = previous.every(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  if (!hasCompletePrevious) {
    return Object.fromEntries(
      cognitive.map((section, index) => [section.sectionId, initial[index]!]),
    );
  }
  const previousTotal = previous.reduce((sum, value) => sum + value, 0);
  if (previousTotal !== input.totalTarget) {
    return Object.fromEntries(
      cognitive.map((section, index) => [section.sectionId, initial[index]!]),
    );
  }
  if (withinWeeklyHold(input)) {
    return Object.fromEntries(
      cognitive.map((section, index) => [section.sectionId, previous[index]!]),
    );
  }

  const known = cognitive.filter(
    (section) => section.currentEstimate != null && section.confidence != null,
  );
  const mean = known.length
    ? known.reduce((sum, section) => sum + section.currentEstimate!, 0) /
      known.length
    : input.totalTarget / cognitive.length;
  const desired = cognitive.map((section, index) => {
    const confidence = section.confidence;
    const evidenceOffset =
      section.currentEstimate == null || confidence == null
        ? 0
        : (section.currentEstimate - mean) *
          CONFIDENCE_WEIGHT[confidence] *
          0.25;
    const raw = initial[index]! + evidenceOffset;
    return (
      Math.round(
        Math.max(MIN_SECTION_TARGET, Math.min(MAX_SECTION_TARGET, raw)) /
          TARGET_STEP,
      ) * TARGET_STEP
    );
  });
  const bounded = desired.map((value, index) =>
    Math.max(
      previous[index]! - MAX_WEEKLY_MOVEMENT,
      Math.min(previous[index]! + MAX_WEEKLY_MOVEMENT, value),
    ),
  );
  const balanced = rebalanceToTotal(
    bounded,
    input.totalTarget,
    previous.map((value) =>
      Math.max(MIN_SECTION_TARGET, value - MAX_WEEKLY_MOVEMENT),
    ),
    previous.map((value) =>
      Math.min(MAX_SECTION_TARGET, value + MAX_WEEKLY_MOVEMENT),
    ),
  );
  return Object.fromEntries(
    cognitive.map((section, index) => [section.sectionId, balanced[index]!]),
  );
}
