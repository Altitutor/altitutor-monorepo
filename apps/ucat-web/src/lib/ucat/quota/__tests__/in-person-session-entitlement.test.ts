import type { Database } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getInPersonSessionResourceEntitlementIds,
  hasInPersonSessionResourceEntitlement,
} from "@/lib/ucat/quota/in-person-session-entitlement";

type AdminClient = SupabaseClient<Database>;

describe("in-person session resource entitlements", () => {
  it("checks a single resource with the student-scoped server RPC", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: true, error: null });
    const client = { rpc } as unknown as AdminClient;

    await expect(
      hasInPersonSessionResourceEntitlement(
        client,
        "student-1",
        "question_set",
        "set-1",
      ),
    ).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      "student_has_in_person_ucat_session_resource",
      {
        p_student_id: "student-1",
        p_resource_type: "question_set",
        p_resource_id: "set-1",
      },
    );
  });

  it("does not query for a missing resource id", async () => {
    const rpc = jest.fn();
    const client = { rpc } as unknown as AdminClient;

    await expect(
      hasInPersonSessionResourceEntitlement(client, "student-1", "mock", null),
    ).resolves.toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("deduplicates bulk candidates and returns the entitled ids", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ resource_id: "lesson-2" }],
      error: null,
    });
    const client = { rpc } as unknown as AdminClient;

    const result = await getInPersonSessionResourceEntitlementIds(
      client,
      "student-1",
      "learning_module",
      ["lesson-1", "lesson-2", "lesson-2", null],
    );

    expect(result).toEqual(new Set(["lesson-2"]));
    expect(rpc).toHaveBeenCalledWith(
      "student_in_person_ucat_session_resource_ids",
      {
        p_student_id: "student-1",
        p_resource_type: "learning_module",
        p_resource_ids: ["lesson-1", "lesson-2"],
      },
    );
  });
});
