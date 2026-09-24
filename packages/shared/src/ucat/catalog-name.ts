export type UcatQuestionSetFormat = "full_section" | "partial_section";

export type UcatCatalogNameInput =
  | { kind: "mock"; catalogIndex: number }
  | {
      kind: "standalone_set";
      catalogIndex: number;
      sectionName: string;
      format: UcatQuestionSetFormat;
    }
  | {
      kind: "mock_set";
      mockCatalogIndex: number;
      sectionName: string;
    };

const SECTION_ABBREVIATIONS: Record<string, string> = {
  "verbal reasoning": "VR",
  "decision making": "DM",
  "quantitative reasoning": "QR",
  "situational judgement": "SJT",
};

export function ucatSectionAbbreviation(sectionName: string): string {
  const normalized = sectionName.trim().toLowerCase();
  const known = SECTION_ABBREVIATIONS[normalized];
  if (known) return known;

  const words = sectionName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "Set";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
}

export function formatUcatCatalogName(
  input: UcatCatalogNameInput,
  presentation: "expanded" | "compact" = "expanded",
): string {
  if (input.kind === "mock") return `Mock ${input.catalogIndex}`;

  const section = presentation === "compact"
    ? ucatSectionAbbreviation(input.sectionName)
    : input.sectionName;

  if (input.kind === "mock_set") {
    return `Mock ${input.mockCatalogIndex} ${section}`;
  }

  const format = input.format === "full_section" ? "Full" : "Partial";
  return `${section} ${format} Set ${input.catalogIndex}`;
}
