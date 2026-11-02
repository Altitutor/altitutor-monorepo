/** @jest-environment node */
import { executeEmailCommand } from "../client";
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});
it.each(["read", "move"] as const)(
  "performs %s on a105-message conversation through bounded requests",
  async (action) => {
    const groups: string[][] = [];
    global.fetch = jest.fn(async (_input, init) => {
      groups.push(JSON.parse(String(init?.body)).ids);
      return Response.json({ state: "saved" });
    });
    const ids = Array.from({ length: 105 }, (_, index) => `message-${index}`);
    await executeEmailCommand(
      action === "read"
        ? { action, ids, read: false }
        : { action, ids, folderId: "archive" },
    );
    expect(groups.map((group) => group.length)).toEqual([25, 25, 25, 25, 5]);
    expect(groups.flat()).toEqual(ids);
  },
);
it("stops later batches when Microsoft work cannot be confirmed", async () => {
  let requests = 0;
  global.fetch = jest.fn(async () =>
    ++requests === 2
      ? Response.json({ error: "Provider unavailable" }, { status: 503 })
      : Response.json({ state: "saved" }),
  );
  await expect(
    executeEmailCommand({
      action: "move",
      ids: Array.from({ length: 105 }, (_, index) => `message-${index}`),
      folderId: "archive",
    }),
  ).rejects.toThrow("Provider unavailable");
  expect(requests).toBe(2);
});
it("retains confirmed Undo receipts when a later conversation batch fails", async () => {
  let requests = 0;
  global.fetch = jest.fn(async () =>
    ++requests === 2
      ? Response.json({ error: "Provider unavailable" }, { status: 503 })
      : Response.json({
          state: "saved",
          undoIds: ["fa250000-0000-4000-8000-000000000099"],
        }),
  );
  await expect(
    executeEmailCommand({
      action: "move",
      ids: Array.from({ length: 105 }, (_, index) => `message-${index}`),
      folderId: "archive",
    }),
  ).resolves.toMatchObject({
    state: "partial",
    undoIds: ["fa250000-0000-4000-8000-000000000099"],
  });
  expect(requests).toBe(2);
});
