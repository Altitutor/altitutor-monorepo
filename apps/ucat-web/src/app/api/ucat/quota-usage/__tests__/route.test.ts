/** @jest-environment node */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { GET } from "../route";
import { createGatewayReadFetch } from "@/lib/supabase/gateway-read-fetch";

let mockAdmin: SupabaseClient<Database>;

jest.mock("@/lib/supabase/admin", () => ({
  get supabaseAdmin() {
    return mockAdmin;
  },
}));
jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
    },
  }),
}));
jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));

const origin = "https://database.example";

function configureUpstream(quotaBoundaryResponse: () => Response) {
  const fetcher = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(
    async (input) => {
      const { pathname, searchParams } = new URL(String(input));
      switch (pathname) {
        case "/rest/v1/students":
          return Response.json(
            searchParams.get("select") === "id"
              ? [{ id: "student-1" }]
              : [{ timezone: "UTC" }],
          );
        case "/rest/v1/rpc/get_student_ucat_online_tier":
          return Response.json("free");
        case "/rest/v1/rpc/is_ucat_online_quota_exempt":
          return Response.json(false);
        case "/rest/v1/ucat_subscription_config":
          return Response.json([
            {
              free_learn_limit: 3,
              free_learn_period: "week",
              free_practice_limit: 0,
              free_sets_limit: 0,
              free_mocks_limit: 0,
              free_skill_trainer_limit: 0,
            },
          ]);
        case "/rest/v1/rpc/get_ucat_free_quota_reset_boundary":
          return quotaBoundaryResponse();
        case "/rest/v1/ucat_student_learning_module_progress":
        case "/rest/v1/ucat_free_quota_reset_entitlements":
          return Response.json([]);
        default:
          throw new Error(`Unexpected fixture request to ${pathname}`);
      }
    },
  );

  mockAdmin = createClient<Database>(origin, "fixture-key", {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: createGatewayReadFetch(origin, fetcher) },
  });
}

test.each([200, 502])(
  "an HTML quota boundary response (HTTP %s) returns a controlled JSON error",
  async (status) => {
    const boundaryResponse = jest.fn(
      () =>
        new Response("<html>Upstream error</html>", {
          status,
          headers: { "Content-Type": "text/html" },
        }),
    );
    configureUpstream(boundaryResponse);

    const result = await GET();

    expect(boundaryResponse).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(500);
    expect(await result.json()).toEqual({
      error: "Failed to load quota usage",
    });
  },
);

test("a valid boundary still returns quota usage", async () => {
  const boundaryResponse = jest.fn(() => Response.json(null));
  configureUpstream(boundaryResponse);

  const result = await GET();

  expect(boundaryResponse).toHaveBeenCalledTimes(1);
  expect(result.status).toBe(200);
  expect(await result.json()).toMatchObject({
    onlineTier: "free",
    isQuotaExempt: false,
    areas: expect.arrayContaining([
      expect.objectContaining({
        area: "learn",
        used: 0,
        limit: 3,
        period: "week",
      }),
    ]),
  });
});
