/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST } from "../route";

const mockRetrieve = jest.fn();
const mockExpire = jest.fn();
const mockUpdate = jest.fn();
let giftStatus = "checkout_pending";
let giftKind: "recipient" | "earned_referrer" | null = "recipient";
jest.mock("server-only", () => ({}));
jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));
jest.mock("@/lib/ucat/referrals/capture-referral", () => ({}));
jest.mock("@/lib/ucat/founder-offers/server", () => ({
  founderHistory: async () => [],
}));
jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user" } } }) },
  }),
}));
jest.mock("stripe", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    checkout: {
      sessions: {
        retrieve: (...args: unknown[]) => mockRetrieve(...args),
        expire: (...args: unknown[]) => mockExpire(...args),
      },
    },
  })),
}));
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        delete: () => query,
        limit: () => query,
        update: (value: { gift_status?: string }) => {
          mockUpdate(table, value);
          if (value.gift_status) giftStatus = value.gift_status;
          return query;
        },
        maybeSingle: async () => ({
          data:
            table === "students"
              ? { id: "student" }
              : table === "ucat_referrals" && giftKind === "recipient"
                ? { id: "gift", referred_checkout_session_id: "cs_old" }
                : table === "ucat_referral_access_gifts" &&
                    giftKind === "earned_referrer"
                  ? { id: "gift", stripe_checkout_session_id: "cs_old" }
                  : null,
          error: null,
        }),
        then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return query;
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  giftStatus = "checkout_pending";
  giftKind = "recipient";
  mockRetrieve.mockResolvedValue({
    id: "cs_old",
    status: "expired",
    metadata: {
      student_id: "student",
      ucat_referral_gift_id: "gift",
      ucat_referral_gift_kind: "referred",
    },
  });
});
it("recovers an earned referral gift without a checkout hold", async () => {
  giftKind = "earned_referrer";
  mockRetrieve.mockResolvedValue({
    id: "cs_old",
    status: "expired",
    metadata: {
      student_id: "student",
      ucat_referral_gift_id: "gift",
      ucat_referral_gift_kind: "earned_referrer",
    },
  });
  expect((await cancel()).status).toBe(200);
  expect(mockUpdate).toHaveBeenCalledWith("ucat_referral_access_gifts", {
    status: "available",
    stripe_checkout_session_id: null,
  });
});
it("is a safe no-op when there is no checkout to cancel", async () => {
  giftKind = null;
  expect((await cancel()).status).toBe(200);
  expect(mockRetrieve).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
});
const cancel = () =>
  POST(
    new NextRequest("https://ucat.test/api/ucat/invitations", {
      method: "POST",
      body: JSON.stringify({ action: "cancel_checkout" }),
    }),
  );
it("recovers a referral checkout after its hold is gone so a founder offer can be selected", async () => {
  const response = await cancel();
  expect(response.status).toBe(200);
  expect(giftStatus).toBe("pending");
  expect(mockRetrieve).toHaveBeenCalledWith("cs_old");
  expect(mockExpire).not.toHaveBeenCalled();
});
it("expires a still-open orphaned checkout before releasing the gift", async () => {
  mockRetrieve.mockResolvedValue({
    id: "cs_old",
    status: "open",
    metadata: {
      student_id: "student",
      ucat_referral_gift_id: "gift",
      ucat_referral_gift_kind: "recipient",
    },
  });
  expect((await cancel()).status).toBe(200);
  expect(mockExpire).toHaveBeenCalledWith("cs_old");
  expect(giftStatus).toBe("pending");
});
it.each([
  { status: "complete", student_id: "student" },
  { status: "expired", student_id: "other-student" },
])("does not release an unsafe session: %j", async ({ status, student_id }) => {
  mockRetrieve.mockResolvedValue({
    id: "cs_old",
    status,
    metadata: { student_id, ucat_referral_gift_id: "gift" },
  });
  expect((await cancel()).status).toBe(409);
  expect(mockExpire).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
});
