import { GET } from "../route";

const mockRetrieve = jest.fn();
const mockList = jest.fn();
const mockAutoPagingToArray = jest.fn();
const mockGetSession = jest.fn();
const mockStaffSingle = jest.fn();
const mockInvoiceSingle = jest.fn();

jest.mock("stripe", () =>
  jest.fn().mockImplementation(() => ({
    invoices: { retrieve: mockRetrieve },
    creditNotes: { list: mockList },
  })),
);
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));
jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));
jest.mock("@/shared/lib/supabase/server-ssr", () => ({
  createClient: () => ({
    auth: { getSession: mockGetSession },
    from: (table: string) =>
      table === "staff"
        ? { select: () => ({ eq: () => ({ single: mockStaffSingle }) }) }
        : {
            select: () => ({
              eq: () => ({ is: () => ({ single: mockInvoiceSingle }) }),
            }),
          },
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: "staff" } } },
    error: null,
  });
  mockStaffSingle.mockResolvedValue({
    data: { role: "ADMINSTAFF", status: "ACTIVE" },
    error: null,
  });
  mockInvoiceSingle.mockResolvedValue({
    data: { stripe_invoice_id: "in_test" },
    error: null,
  });
  mockRetrieve.mockResolvedValue({
    attempt_count: 1,
    next_payment_attempt: null,
    amount_paid: 6000,
    amount_remaining: 0,
  });
  mockList.mockReturnValue({ autoPagingToArray: mockAutoPagingToArray });
  mockAutoPagingToArray.mockResolvedValue([
    {
      id: "cn_test",
      amount: 4000,
      pre_payment_amount: 4000,
      post_payment_amount: 0,
      currency: "aud",
      created: 1791259200,
      reason: "order_change",
      status: "issued",
      memo: "Cancelled lesson",
      metadata: { internal_note: "Manager approved" },
      refunds: [],
      customer_balance_transaction: null,
      out_of_band_amount: null,
    },
  ]);
});

function readDetails(includeCreditNotes = false) {
  const query = includeCreditNotes ? "include_credit_notes=true" : "";
  return GET(
    { nextUrl: { searchParams: new URLSearchParams(query) } } as never,
    { params: { id: "invoice" } },
  );
}

it("returns canonical payment and credit-note outcomes, paging through the invoice’s credit notes", async () => {
  const response = await readDetails(true);
  expect(response.status).toBe(200);
  expect(mockList).toHaveBeenCalledWith({ invoice: "in_test", limit: 100 });
  expect(mockAutoPagingToArray).toHaveBeenCalledWith({ limit: 10000 });
  expect(await response.json()).toMatchObject({
    amount_paid_cents: 6000,
    amount_remaining_cents: 0,
    credit_notes: [
      {
        stripe_credit_note_id: "cn_test",
        pre_payment_amount_cents: 4000,
        refund_amount_cents: 0,
        credit_amount_cents: 0,
        outcome_verified: true,
        memo: "Cancelled lesson",
        internal_note: "Manager approved",
      },
    ],
  });
});

it("keeps reconciliation’s retry lookup free of additional credit-note requests", async () => {
  const response = await readDetails();
  expect(response.status).toBe(200);
  expect(mockList).not.toHaveBeenCalled();
  expect(await response.json()).not.toHaveProperty("credit_notes");
});

it("requires active admin access before retrieving Stripe details or internal notes", async () => {
  mockStaffSingle.mockResolvedValue({
    data: { role: "TUTOR", status: "ACTIVE" },
    error: null,
  });
  expect((await readDetails(true)).status).toBe(403);
  expect(mockRetrieve).not.toHaveBeenCalled();
  expect(mockList).not.toHaveBeenCalled();
});
