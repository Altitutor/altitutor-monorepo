import {
  encodeViewConfig,
  getViewSettings,
  readViewSettings,
  displaySettingsMatch,
} from "../saved-views";

const defaults = {
  filters: {},
  sortBy: "name",
  sortDirection: "asc" as const,
  groupBy: null,
  visibleColumns: ["name"],
};
const board = {
  filters: { status: ["todo"] },
  sortBy: "priority",
  sortDirection: "desc" as const,
  groupBy: "status",
  visibleColumns: ["name", "assignee"],
  layout: "board",
};

it("stores the full display configuration without confusing layout metadata for a filter", () => {
  expect(readViewSettings(encodeViewConfig(board), defaults)).toEqual(board);
  expect(readViewSettings({ status: ["todo"] }, defaults)).toEqual({
    ...defaults,
    filters: { status: ["todo"] },
  });
});

it("matches equivalent selection sets while distinguishing layout, sort and grouping", () => {
  expect(
    displaySettingsMatch(board, {
      ...board,
      visibleColumns: ["assignee", "name"],
    }),
  ).toBe(true);
  expect(displaySettingsMatch(board, { ...board, layout: "list" })).toBe(false);
  expect(displaySettingsMatch(board, { ...board, sortDirection: "asc" })).toBe(
    false,
  );
  expect(displaySettingsMatch(board, { ...board, groupBy: null })).toBe(false);
});

it("rejects malformed conditions and never applies reserved metadata as a filter", () => {
  const config = {
    $display: [
      {
        version: 1,
        ...board,
        conditions: [
          { fieldKey: "q1", operator: "contains", values: "broken" },
        ],
      },
    ],
  };
  expect(getViewSettings(config)).toBeNull();
  expect(readViewSettings(config, defaults)).toEqual(defaults);
});

it("keeps existing current-user presets working when read as full views", () => {
  expect(
    readViewSettings(
      { assigned_to: ["$ME$"], status: ["todo"] },
      defaults,
      "staff-1",
    ).filters,
  ).toEqual({ assignee: ["staff-1"], status: ["todo"] });
});
