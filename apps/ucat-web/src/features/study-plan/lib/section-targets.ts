export type SectionTargetEvidence = {
  sectionId: string;
  currentEstimate: number | null;
};

export function allocateSectionTargets(
  targetScore: number,
  sections: SectionTargetEvidence[],
): Record<string, number> {
  const cognitive = sections.slice(0, 3);
  if (!cognitive.length) return {};
  const known = cognitive
    .map((section) => section.currentEstimate)
    .filter((value): value is number => value != null);
  const mean = known.length
    ? known.reduce((sum, value) => sum + value, 0) / known.length
    : 600;
  const raw = cognitive.map((section) => {
    const estimate = section.currentEstimate ?? mean;
    return targetScore / 3 + (estimate - mean) * 0.25;
  });
  const rounded = raw.map((value) =>
    Math.max(300, Math.min(900, Math.round(value / 10) * 10)),
  );
  let difference = targetScore - rounded.reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  while (difference !== 0 && cursor < 200) {
    const index = cursor % rounded.length;
    const step = difference > 0 ? 10 : -10;
    if (rounded[index]! + step >= 300 && rounded[index]! + step <= 900) {
      rounded[index]! += step;
      difference -= step;
    }
    cursor += 1;
  }
  return Object.fromEntries(
    cognitive.map((section, index) => [section.sectionId, rounded[index]]),
  );
}
