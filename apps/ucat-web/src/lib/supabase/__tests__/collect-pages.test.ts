import { collectPages } from "@/lib/supabase/collect-pages";

describe("collectPages", () => {
  it("loads every row when PostgREST caps each response", async () => {
    const rows = Array.from({ length: 2_017 }, (_, id) => ({ id }));
    const fetchPage = jest.fn(async (from: number, to: number) => ({
      data: rows.slice(from, to + 1),
      error: null,
    }));

    const result = await collectPages(fetchPage, 1_000);

    expect(result).toEqual(rows);
    expect(fetchPage.mock.calls).toEqual([
      [0, 999],
      [1_000, 1_999],
      [2_000, 2_999],
    ]);
  });

  it("stops immediately on a failed page", async () => {
    const failure = new Error("statement timeout");
    const fetchPage = jest.fn().mockResolvedValue({
      data: null,
      error: failure,
    });

    await expect(collectPages(fetchPage, 1_000)).rejects.toBe(failure);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
