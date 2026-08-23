import { runWithConcurrency } from "@/lib/async/run-with-concurrency";

describe("runWithConcurrency", () => {
  it("preserves result order while enforcing the concurrency ceiling", async () => {
    let active = 0;
    let peak = 0;
    const tasks = Array.from({ length: 12 }, (_, value) => async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return value;
    });

    const results = await runWithConcurrency(tasks, 3);

    expect(results).toEqual(Array.from({ length: 12 }, (_, value) => value));
    expect(peak).toBe(3);
  });

  it("stops scheduling new work after a task fails", async () => {
    let started = 0;
    const failure = new Error("database unavailable");
    const tasks = Array.from({ length: 10 }, (_, index) => async () => {
      started += 1;
      if (index === 0) {
        throw failure;
      }
      await new Promise((resolve) => setTimeout(resolve, 2));
    });

    await expect(runWithConcurrency(tasks, 2)).rejects.toBe(failure);
    expect(started).toBeLessThanOrEqual(2);
  });
});
