/** @jest-environment node */
import { NextRequest } from "next/server";
import { GET } from "../route";
const mockOffer = jest.fn();
let ownsReservation = false;
let userId: string | null = "student-user";
jest.mock("server-only", () => ({}));
jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));
jest.mock("@/lib/ucat/referrals/capture-referral", () => ({
  resolveUcatReferralOfferPreview: jest.fn(),
}));
jest.mock("@/lib/ucat/founder-offers/server", () => ({
  findFounderOffer: (...args: unknown[]) => mockOffer(...args),
}));
jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: userId ? { id: userId } : null } }),
    },
  }),
}));
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        maybeSingle: async () => ({
          data:
            table === "students"
              ? { id: "student" }
              : ownsReservation
                ? { id: "reservation" }
                : null,
          error: null,
        }),
        then: (resolve: (value: { count: number; error: null }) => unknown) =>
          Promise.resolve({ count: 1, error: null }).then(resolve),
      };
      return query;
    },
  },
}));
const offer = {
  id: "offer",
  code: "WELCOME",
  kind: "access_pass",
  name: "Gift",
  campaign: "friends",
  duration_unit: "week",
  duration_count: 2,
  percent_off: null,
  active: true,
  expires_at: null,
  max_redemptions: 1,
};
beforeEach(() => {
  ownsReservation = false;
  userId = "student-user";
  mockOffer.mockResolvedValue(offer);
});
const request = () =>
  new NextRequest("https://ucat.test/api/ucat/invitations?code=WELCOME");
it("allows the owner to check their already-reserved single-use code again", async () => {
  ownsReservation = true;
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    code: "WELCOME",
    kind: "access_pass",
  });
});
it("preserves preview for an existing reservation after disabling new claims", async () => {
  ownsReservation = true;
  mockOffer.mockResolvedValue({ ...offer, active: false });
  expect((await GET(request())).status).toBe(200);
});
it("rejects an exhausted code for another student", async () => {
  expect((await GET(request())).status).toBe(409);
});
it("rejects an exhausted code for an anonymous visitor", async () => {
  userId = null;
  expect((await GET(request())).status).toBe(409);
});
