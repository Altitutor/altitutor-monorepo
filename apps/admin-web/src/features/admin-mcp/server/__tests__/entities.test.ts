/** @jest-environment node */
import { resolveContentReferences } from "../entities";
import { runReportingQuery } from "../reporting";
jest.mock("../reporting", () => ({ runReportingQuery: jest.fn() }));

it("resolves current labels, marks deleted references and retains unknown kinds", async () => {
  jest.mocked(runReportingQuery).mockResolvedValue({
    rows: [{ id: "live", title: "Current procedure" }],
    columns: [],
    truncated: false,
    returnedRows: 1,
    rowLimit: 250,
    catalogVersion: "test",
    queriedAt: "",
    elapsedMs: 0,
  });
  const mentions = await resolveContentReferences({
    content: ["live", "deleted"]
      .map((id) => ({
        type: "mention",
        attrs: { type: "note", id, label: "Old label" },
      }))
      .concat([
        {
          type: "mention",
          attrs: { type: "unknown", id: "other", label: "Preserved" },
        },
      ]),
  });
  expect(mentions[0]).toMatchObject({
    resolution: "resolved",
    context: { title: "Current procedure" },
    adminUiPath: "/documents/live",
  });
  expect(mentions[1]).toMatchObject({
    resolution: "missing",
    id: "deleted",
    label: "Old label",
  });
  expect(mentions[2]).toMatchObject({
    resolution: "unsupported_kind",
    id: "other",
  });
  expect(runReportingQuery).toHaveBeenCalledTimes(1);
});
