import assert from "node:assert/strict";
import { test } from "node:test";
import { tableColumnWidths } from "../features/learning/table-layout";

test("VR format tables share the same column widths across all rows", () => {
  const rows = [
    { content: [{ content: [{ content: [] }] }, { content: [] }] },
    { content: [{ content: [] }, { content: [] }] },
    { content: [{ content: [] }, { content: [] }] },
  ];
  assert.deepEqual(tableColumnWidths(rows, 340), [170, 170]);
  assert.deepEqual(tableColumnWidths(rows, 240), [150, 150]);
});
test("merged headers retain the same grid as their body cells", () => {
  assert.deepEqual(
    tableColumnWidths(
      [{ content: [{ attrs: { colspan: 3 } }] }, { content: [{}, {}, {}] }],
      600,
    ),
    [200, 200, 200],
  );
});
