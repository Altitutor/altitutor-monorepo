export const SECTION_NUMBER_TO_NAME: Record<number, string> = {
  1: "Verbal Reasoning",
  2: "Decision Making",
  3: "Quantitative Reasoning",
  4: "Situational Judgement",
};

export const SECTION_NAME_TO_NUMBER: Record<string, number> =
  Object.fromEntries(
    Object.entries(SECTION_NUMBER_TO_NAME).map(([num, name]) => [
      name,
      Number(num),
    ]),
  );

export function formatSetSections(
  sections: Array<{ section_number?: number; name?: string }> | null,
): string {
  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    return "";
  }
  const names = sections
    .map(
      (s) =>
        s.name ??
        SECTION_NUMBER_TO_NAME[s.section_number ?? 0] ??
        `Section ${s.section_number ?? "?"}`,
    )
    .filter(Boolean);
  return names.join(", ");
}
