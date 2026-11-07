import type { Database } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CURRENT_PREPARATION_VERSIONS } from "@/features/preparation/lib/policy";
import { loadLatestPreparationSnapshot } from "@/features/preparation/server/preparation-snapshot";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: null }));

it("loads the latest snapshot using score compatibility across Study-plan policy changes", async () => {
  const versions = CURRENT_PREPARATION_VERSIONS;
  const snapshot = { versions: { ...versions, policy: "previous-policy" } };
  const generatedAt = "2026-10-31T00:00:00.000Z";
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: { generated_at: generatedAt, snapshot },
      error: null,
    }),
  };
  const from = jest.fn().mockReturnValue(query);
  const supabase = { from } as unknown as SupabaseClient<Database>;

  await expect(
    loadLatestPreparationSnapshot(supabase, versions),
  ).resolves.toEqual({
    ...snapshot,
    generatedAt,
  });
  expect(from).toHaveBeenCalledWith("vstudent_ucat_preparation_snapshots");
  expect(query.eq.mock.calls).toEqual([
    ["engine_version", versions.engine],
    ["score_model_version", versions.scoreModel],
    ["trajectory_model_version", versions.trajectoryModel],
  ]);
  expect(query.order).toHaveBeenCalledWith("generated_at", {
    ascending: false,
  });
  expect(query.limit).toHaveBeenCalledWith(1);
});
