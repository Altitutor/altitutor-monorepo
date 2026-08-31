import {
  compareStudentSetsByCatalog,
  type StudentSetRow,
} from "@/features/sets/api/sets-api";

function setRow(overrides: Partial<StudentSetRow>): StudentSetRow {
  return {
    id: "set",
    description: null,
    time_limit_seconds: 1320,
    sections: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

describe("compareStudentSetsByCatalog", () => {
  it("orders published sets by catalog index instead of name", () => {
    const shuffled = [
      setRow({
        id: "10",
        display_name: "Verbal Reasoning Full Set 10",
        section_number: 1,
        set_format: "full_section",
        catalog_index: 10,
      }),
      setRow({
        id: "1",
        display_name: "Verbal Reasoning Full Set 1",
        section_number: 1,
        set_format: "full_section",
        catalog_index: 1,
      }),
      setRow({
        id: "2",
        display_name: "Verbal Reasoning Full Set 2",
        section_number: 1,
        set_format: "full_section",
        catalog_index: 2,
      }),
    ];

    expect(
      [...shuffled].sort(compareStudentSetsByCatalog).map((set) => set.id),
    ).toEqual(["1", "2", "10"]);
  });

  it("keeps full sets before partial sets, then unnumbered rows last", () => {
    const shuffled = [
      setRow({
        id: "partial-1",
        section_number: 1,
        set_format: "partial_section",
        catalog_index: 1,
      }),
      setRow({
        id: "unnumbered",
        section_number: 1,
        set_format: "full_section",
        catalog_index: null,
      }),
      setRow({
        id: "full-2",
        section_number: 1,
        set_format: "full_section",
        catalog_index: 2,
      }),
    ];

    expect(
      [...shuffled].sort(compareStudentSetsByCatalog).map((set) => set.id),
    ).toEqual(["full-2", "unnumbered", "partial-1"]);
  });
});
