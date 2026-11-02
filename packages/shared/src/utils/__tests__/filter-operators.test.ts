import {
  choiceFilterMatches,
  dateFilterBounds,
  filterQueryCandidates,
} from "../filter-operators";

it("supports all calendar comparisons without losing the selected anchor day", () => {
  expect(dateFilterBounds("before", "2026-03-01")).toEqual({
    to: "2026-02-28",
  });
  expect(dateFilterBounds("after", "2026-12-31")).toEqual({
    from: "2027-01-01",
  });
  expect(dateFilterBounds("on", "2026-10-22")).toEqual({
    from: "2026-10-22",
    to: "2026-10-22",
  });
  expect(dateFilterBounds("on_or_after", "2026-10-22")).toEqual({
    from: "2026-10-22",
  });
  expect(dateFilterBounds("on_or_before", "2026-10-22")).toEqual({
    to: "2026-10-22",
  });

});
it("uses any/all/none for actual relationship values and fetches a safe candidate superset", () => {
  expect(choiceFilterMatches(["alice", "bob"], ["alice"], "any")).toBe(true);
  expect(choiceFilterMatches(["alice", "bob"], ["alice"], "all")).toBe(false);
  expect(choiceFilterMatches(["alice", "bob"], ["charlie"], "none")).toBe(true);
  expect(
    filterQueryCandidates({
      subject: ["bio"],
      subject__operator: ["none"],
      date__anchor: ["2026-10-22"],
      search: "",
    }),
  ).toEqual({});
});
