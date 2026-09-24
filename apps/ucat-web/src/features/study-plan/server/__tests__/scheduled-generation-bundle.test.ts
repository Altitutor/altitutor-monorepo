/** @jest-environment node */

import { createPreloadedStudentClient } from "@/features/study-plan/server/study-plan-service";

jest.mock("server-only", () => ({}));
jest.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: null }));

describe("scheduled Study-plan generation bundle", () => {
  it("retains Supabase filtering, ordering, and paging semantics in memory", async () => {
    const client = createPreloadedStudentClient({
      vstudent_ucat_completed_set_assets: [
        { question_set_id: "set-3", completed_at: null },
        {
          question_set_id: "set-2",
          completed_at: "2026-08-02T00:00:00.000Z",
        },
        {
          question_set_id: "set-1",
          completed_at: "2026-08-01T00:00:00.000Z",
        },
      ],
    });

    const { data, error } = await client
      .from("vstudent_ucat_completed_set_assets")
      .select("question_set_id, completed_at")
      .neq("question_set_id", "set-3")
      .not("completed_at", "is", null)
      .order("question_set_id")
      .range(0, 0);

    expect(error).toBeNull();
    expect(data).toEqual([
      expect.objectContaining({ question_set_id: "set-1" }),
    ]);
  });
});
