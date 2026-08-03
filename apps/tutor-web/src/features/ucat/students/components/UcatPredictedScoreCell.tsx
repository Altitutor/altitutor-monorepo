import type { StudentProgressSummaryRow } from "@/features/ucat/students/api/students";

type Section = {
  id: string;
  name: string;
  section_number: number;
};

function sectionLabel(section: Section): string {
  if (section.section_number === 1) return "VR";
  if (section.section_number === 2) return "DM";
  if (section.section_number === 3) return "QR";
  if (section.section_number === 4) return "SJ";
  return section.name;
}

export function getCognitivePredictedScore(
  student: StudentProgressSummaryRow,
  sections: Section[],
): number | null {
  const cognitiveSections = sections
    .filter(
      (section) => section.section_number >= 1 && section.section_number <= 3,
    )
    .sort((a, b) => a.section_number - b.section_number);
  const scores = cognitiveSections.map(
    (section) => student.section_scores[section.id],
  );

  return cognitiveSections.length === 3 &&
    scores.every((score) => score != null)
    ? scores.reduce<number>((total, score) => total + (score ?? 0), 0)
    : null;
}

export function UcatPredictedScoreCell({
  student,
  sections,
}: {
  student: StudentProgressSummaryRow;
  sections: Section[];
}) {
  const cognitiveScore = getCognitivePredictedScore(student, sections);
  const orderedSections = [...sections].sort(
    (a, b) => a.section_number - b.section_number,
  );

  return (
    <div className="min-w-[230px] py-1">
      <div className="text-base font-semibold tabular-nums">
        {cognitiveScore ?? "—"}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        {orderedSections.map((section) => (
          <span key={section.id} className="whitespace-nowrap tabular-nums">
            {sectionLabel(section)} {student.section_scores[section.id] ?? "—"}
          </span>
        ))}
      </div>
    </div>
  );
}
