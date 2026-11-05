import { readInterviewRoundSummaries } from "../round-summaries";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
jest.mock("@/shared/lib/supabase/client", () => ({
  getSupabaseClient: jest.fn(),
}));
test("metadata reads exhaust pages beyond the PostgREST cap without loading station content", async () => {
  const range = jest.fn(async (from: number, _to: number) => ({
    data: Array.from({ length: from === 0 ? 1000 : 1 }, (_, i) => ({
      id: `round-${from + i}`,
      round_name: "MMI",
      scheduled_at: "2026-11-05T00:00:00Z",
      student_ids: ["alice"],
      students: [{ id: "alice", name: "Alice" }],
      tutors: [],
      assignments: [{}, {}],
    })),
    error: null,
  }));
  const query = {
    select: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range,
  };
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue({ from: () => query } as unknown as ReturnType<
      typeof getSupabaseClient
    >);
  const rows = await readInterviewRoundSummaries({
    rangeStart: "2026-11-05",
    rangeEnd: "2026-11-05",
    scheduledOnly: true,
  });
  expect(rows).toHaveLength(1001);
  expect(rows[1000].id).toBe("round-1000");
  expect(range).toHaveBeenNthCalledWith(1, 0, 999);
  expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
  expect(query.select.mock.calls[0][0]).not.toContain("data->stations");
  expect(query.select.mock.calls[0][0]).not.toBe("id,data");
});
