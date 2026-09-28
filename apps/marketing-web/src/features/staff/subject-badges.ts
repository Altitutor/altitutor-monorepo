export type TeachingSubject = { name: string; curriculum: string | null };
const curriculumLabels: Record<string, string> = {
  SACE: "SACE",
  IB: "IB",
  PRESACE: "PreSACE",
  PRIMARY: "Primary",
};
const curriculumOrder = ["SACE", "IB", "PRESACE", "PRIMARY"];

/** Year levels and IB levels intentionally do not participate in badge identity. */
export function subjectBadges(subjects: TeachingSubject[]): string[] {
  const unique = new Map<string, { label: string; order: number }>();
  for (const subject of subjects) {
    const name = subject.name.trim();
    if (!name || name.toLowerCase() === "homework help") continue;
    const curriculum = subject.curriculum?.trim().toUpperCase() ?? "";
    const prefix = curriculumLabels[curriculum];
    const label = prefix ? `${prefix} ${name}` : name;
    const group = curriculumOrder.indexOf(curriculum);
    unique.set(`${curriculum}:${name.toLowerCase()}`, {
      label,
      order: group < 0 ? 4 : group,
    });
  }
  return [...unique.values()]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "en"))
    .map((subject) => subject.label);
}
