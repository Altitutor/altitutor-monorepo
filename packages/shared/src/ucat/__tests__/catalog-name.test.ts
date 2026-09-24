import { formatUcatCatalogName, ucatSectionAbbreviation } from "../catalog-name";

describe("UCAT catalog names", () => {
  it("uses canonical section abbreviations", () => {
    expect(ucatSectionAbbreviation("Verbal Reasoning")).toBe("VR");
    expect(ucatSectionAbbreviation("Situational Judgement")).toBe("SJT");
  });

  it("formats year-independent mock names", () => {
    expect(formatUcatCatalogName({ kind: "mock", catalogIndex: 2 })).toBe("Mock 2");
  });

  it("formats standalone set names in expanded and compact forms", () => {
    const input = {
      kind: "standalone_set" as const,
      catalogIndex: 3,
      sectionName: "Quantitative Reasoning",
      format: "partial_section" as const,
    };
    expect(formatUcatCatalogName(input)).toBe("Quantitative Reasoning Partial Set 3");
    expect(formatUcatCatalogName(input, "compact")).toBe("QR Partial Set 3");
  });

  it("formats mock-relative component names", () => {
    const input = {
      kind: "mock_set" as const,
      mockCatalogIndex: 1,
      sectionName: "Verbal Reasoning",
    };
    expect(formatUcatCatalogName(input)).toBe("Mock 1 Verbal Reasoning");
    expect(formatUcatCatalogName(input, "compact")).toBe("Mock 1 VR");
  });
});
