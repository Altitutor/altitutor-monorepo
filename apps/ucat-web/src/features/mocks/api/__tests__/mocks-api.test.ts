import {
  compareStudentMocksByCatalog,
  type StudentMockRow,
} from "@/features/mocks/api/mocks-api";

function mockRow(overrides: Partial<StudentMockRow>): StudentMockRow {
  return {
    id: "mock",
    name: null,
    display_name: null,
    created_at: null,
    updated_at: null,
    created_by: null,
    set_count: 4,
    has_timed_sets: true,
    catalog_index: null,
    setTimings: [],
    totalTimeLimitSeconds: null,
    ...overrides,
  };
}

describe("compareStudentMocksByCatalog", () => {
  it("orders mocks by catalog index instead of name", () => {
    const shuffled = [
      mockRow({ id: "10", display_name: "Mock 10", catalog_index: 10 }),
      mockRow({ id: "1", display_name: "Mock 1", catalog_index: 1 }),
      mockRow({ id: "2", display_name: "Mock 2", catalog_index: 2 }),
    ];

    expect(
      [...shuffled].sort(compareStudentMocksByCatalog).map((mock) => mock.id),
    ).toEqual(["1", "2", "10"]);
  });
});
