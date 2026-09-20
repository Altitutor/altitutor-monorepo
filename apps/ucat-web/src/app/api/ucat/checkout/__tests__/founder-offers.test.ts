/** @jest-environment node */
import type { NextRequest } from "next/server";
import { POST } from "../route";

const mockCreate = jest.fn();
const mockRetrieve = jest.fn();
const mockRpc = jest.fn();
const mockClaim = jest.fn();
const mockHistory = jest.fn();
const mockOffer = jest.fn();
const mockFrom = jest.fn();
let student = {
  id: "student-1",
  email: "founder@example.test",
  ucat_unlimited_trial_consumed_at: null as string | null,
  students_billing: null,
  student_subscriptions: [] as {
    id: string;
    subject_id: string;
    status: string;
  }[],
};
let hold = {
  id: "hold-1",
  created_at: "2026-09-20T00:00:00Z",
  suppress_trial: false,
  checkout_session_id: null as string | null,
};

jest.mock("server-only", () => ({}));
jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
    },
  }),
}));
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));
jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));
jest.mock("@/lib/ucat/ucat-subject-id", () => ({
  getUcatSubjectId: async () => "ucat",
}));
jest.mock("@/lib/ucat/plan-price-lookup", () => ({
  getUcatPlanPrice: async () => ({
    stripe_price_id: "price_week",
    checkout_enabled: true,
  }),
  stripePriceMatchesUcatPlan: async () => true,
}));
jest.mock("@/lib/ucat/founder-offers/server", () => ({
  findFounderOffer: (...args: unknown[]) => mockOffer(...args),
  founderHistory: (...args: unknown[]) => mockHistory(...args),
  founderCoupon: async () => ({ id: "coupon_founder" }),
  claimFounderOffer: (...args: unknown[]) => mockClaim(...args),
}));
jest.mock("stripe", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockCreate(...args),
        retrieve: (...args: unknown[]) => mockRetrieve(...args),
      },
    },
  })),
}));

function result(data: unknown) {
  const response = { data, error: null };
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
    gt: jest.fn(),
    limit: jest.fn(),
    order: jest.fn(),
    update: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
    is: jest.fn(),
    maybeSingle: jest.fn(async () => response),
    then: (resolve: (value: typeof response) => unknown) =>
      Promise.resolve(response).then(resolve),
  };
  for (const method of [
    query.select,
    query.eq,
    query.in,
    query.gt,
    query.limit,
    query.order,
    query.update,
    query.insert,
    query.delete,
    query.is,
  ])
    method.mockReturnValue(query);
  return query;
}
function request(extra: Record<string, unknown> = {}) {
  return {
    json: async () => ({
      tier: "unlimited",
      interval: "week",
      founderCode: "F-FOUNDERS",
      ...extra,
    }),
    headers: new Headers(),
    nextUrl: new URL("https://ucat.example.test/api/ucat/checkout"),
  } as unknown as NextRequest;
}

describe("founder discount checkout", () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_local";
    student = {
      id: "student-1",
      email: "founder@example.test",
      ucat_unlimited_trial_consumed_at: null,
      students_billing: null,
      student_subscriptions: [],
    };
    hold = {
      id: "hold-1",
      created_at: "2026-09-20T00:00:00Z",
      suppress_trial: false,
      checkout_session_id: null,
    };
    mockFrom.mockImplementation((table: string) =>
      result(
        table === "students"
          ? student
          : table === "ucat_subscription_config"
            ? { trial_days: 5 }
            : null,
      ),
    );
    mockRpc.mockImplementation(async (name: string) => ({
      data: name === "reserve_ucat_checkout" ? hold : null,
      error: null,
    }));
    mockHistory.mockResolvedValue([]);
    mockOffer.mockResolvedValue({
      id: "offer-1",
      code: "F-FOUNDERS",
      kind: "discount",
      percent_off: 20,
      campaign: "founders",
    });
    mockClaim.mockResolvedValue({
      id: "redemption-1",
      status: "reserved",
      checkout_session_id: null,
      reserved_at: hold.created_at,
    });
    mockCreate.mockResolvedValue({ id: "cs_1", client_secret: "secret_1" });
  });
  afterAll(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
  });

  it("puts the discount and durable attribution on Stripe, using a stable retry key", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        discounts: [{ coupon: "coupon_founder" }],
        metadata: expect.objectContaining({
          ucat_founder_offer_id: "offer-1",
          ucat_founder_redemption_id: "redemption-1",
          ucat_founder_code: "F-FOUNDERS",
        }),
        subscription_data: expect.objectContaining({
          metadata: expect.objectContaining({
            ucat_founder_campaign: "founders",
          }),
          trial_period_days: 5,
        }),
      }),
      { idempotencyKey: "ucat-checkout:hold-1" },
    );
    expect(await response.json()).toMatchObject({ founderPercentOff: 20 });
  });
  it("starts paid billing immediately after a no-card access pass", async () => {
    mockHistory.mockResolvedValue([
      { kind: "access_pass", status: "redeemed" },
    ]);
    const response = await POST(request());
    expect(response.status).toBe(200);
    const params = mockCreate.mock.calls[0][0];
    expect(params.subscription_data.trial_period_days).toBeUndefined();
    expect(await response.json()).toMatchObject({
      trialEligible: false,
      trialDays: 0,
    });
  });
  it("honours a pass consumed concurrently before the checkout lock", async () => {
    hold.suppress_trial = true;
    await POST(request());
    expect(
      mockCreate.mock.calls[0][0].subscription_data.trial_period_days,
    ).toBeUndefined();
  });
  it("refuses applying founder discounts to an existing subscriber", async () => {
    student.student_subscriptions = [
      { id: "sub-1", subject_id: "ucat", status: "active" },
    ];
    expect((await POST(request())).status).toBe(400);
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
  it("refuses combining a founder discount and referral gift", async () => {
    expect((await POST(request({ referralGiftId: "gift-1" }))).status).toBe(
      409,
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });
  it("refuses starting referral checkout after a founder pass", async () => {
    mockHistory.mockResolvedValue([
      { kind: "access_pass", status: "redeemed" },
    ]);
    expect(
      (
        await POST(
          request({ founderCode: undefined, referralGiftId: "gift-1" }),
        )
      ).status,
    ).toBe(409);
    expect(mockCreate).not.toHaveBeenCalled();
  });
  it("recovers an existing open session without redeeming another place", async () => {
    hold.checkout_session_id = "cs_existing";
    mockRetrieve.mockResolvedValue({
      id: "cs_existing",
      client_secret: "old_secret",
      status: "open",
      metadata: {},
    });
    expect((await POST(request())).status).toBe(200);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockClaim).not.toHaveBeenCalled();
  });
  it("does not contact Stripe checkout when the redemption cap rejects a claim", async () => {
    mockClaim.mockRejectedValueOnce(new Error("All places are claimed."));
    expect((await POST(request())).status).toBe(409);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
