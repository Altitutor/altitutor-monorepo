/** @jest-environment node */
import { readAdminInterviewRound } from "../read";
import { createClient } from "@/shared/lib/supabase/server-ssr";
import { getServerSupabaseAdmin } from "@/shared/lib/supabase/server";
jest.mock("@/shared/lib/supabase/server-ssr", () => ({
  createClient: jest.fn(),
}));
jest.mock("@/shared/lib/supabase/server", () => ({
  getServerSupabaseAdmin: jest.fn(),
}));
const create = jest.mocked(createClient);
const admin = jest.mocked(getServerSupabaseAdmin);
const id = "d3080000-0000-4000-8000-000000000021";
test.each([false, null])(
  "inactive and unauthorized staff cannot trigger service reads (%s)",
  async (allowed) => {
    create.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "user" } }, error: null }),
      },
      rpc: async () => ({ data: allowed, error: null }),
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    const result = await readAdminInterviewRound(id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
    expect(admin).not.toHaveBeenCalled();
  },
);
test("an active admin receives the authoritative projection", async () => {
  create.mockResolvedValue({
    auth: {
      getUser: async () => ({ data: { user: { id: "user" } }, error: null }),
    },
    rpc: async () => ({ data: true, error: null }),
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  const rpc = jest
    .fn()
    .mockResolvedValue({
      data: { id, phase: "feedback", serverNow: "2026-11-05T12:00:00Z" },
      error: null,
    });
  admin.mockReturnValue({ rpc } as unknown as ReturnType<
    typeof getServerSupabaseAdmin
  >);
  const result = await readAdminInterviewRound(id);
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.round.phase).toBe("feedback");
  expect(rpc).toHaveBeenCalledWith("interview_media_state", { p_round_id: id });
});
