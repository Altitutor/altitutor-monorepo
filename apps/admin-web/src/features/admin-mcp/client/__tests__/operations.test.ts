import { WorkItemRevisions } from "../operations";

jest.mock("@/shared/lib/supabase/client", () => ({
  getSupabaseClient: jest.fn(),
}));

test("a background refresh cannot advance the revision accepted by an open editor", async () => {
  const revisions = new WorkItemRevisions();
  revisions.observe([{ id: "task", admin_revision: 1, title: "Original" }]);
  revisions.observe({
    id: "task",
    admin_revision: 2,
    title: "Someone else edited",
  });
  const save = jest.fn().mockRejectedValue(new Error("Conflict"));
  await expect(revisions.change("task", save)).rejects.toThrow("Conflict");
  expect(save).toHaveBeenCalledWith(1);
});

test("serializes autosaves and advances only an acknowledged write", async () => {
  const revisions = new WorkItemRevisions();
  revisions.observe({ id: "task", admin_revision: 1 });
  const first = jest.fn().mockResolvedValue({ id: "task", admin_revision: 2 });
  const second = jest.fn().mockResolvedValue({ id: "task", admin_revision: 3 });
  await Promise.all([
    revisions.change("task", first),
    revisions.change("task", second),
  ]);
  expect(first).toHaveBeenCalledWith(1);
  expect(second).toHaveBeenCalledWith(2);
});
