/** @jest-environment node */
import { POST } from "../route";

const mockRetrieveInvoice = jest.fn();
const mockListLineItems = jest.fn();
const mockGetSession = jest.fn();
const mockStaffSingle = jest.fn();
const mockInvoiceSingle = jest.fn();
const mockBillingPrefs = jest.fn();
const mockStudentSingle = jest.fn();
const mockParents = jest.fn();
const mockEmailDelivery = jest.fn();
const mockRecordDomainEvent = jest.fn();

jest.mock("stripe", () =>
  jest.fn().mockImplementation(() => ({
    invoices: {
      retrieve: mockRetrieveInvoice,
      listLineItems: mockListLineItems,
    },
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
jest.mock("server-only", () => ({}));
jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }));
jest.mock("@/shared/lib/supabase/server/admin", () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => mockRecordDomainEvent(...args),
  },
}));
jest.mock("@/shared/lib/supabase/server-ssr", () => ({
  createClient: () => ({
    auth: { getSession: mockGetSession },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: table === "staff" ? mockStaffSingle : mockStudentSingle,
          is: () => ({ single: mockInvoiceSingle }),
          maybeSingle: mockBillingPrefs,
          returns: mockParents,
        }),
      }),
    }),
  }),
}));

const originalFetch = global.fetch;
const previousEnv = { ...process.env };
afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...previousEnv };
});
beforeEach(() => {
  jest.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:1";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-key";
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL_TARGET_ENV;
  process.env.EMAIL_ENVIRONMENT = "production";
  process.env.EMAIL_M365_TENANT_ID = "fixture-tenant";
  process.env.EMAIL_M365_CLIENT_ID = "fixture-client";
  process.env.EMAIL_M365_CLIENT_SECRET = "fixture-secret";
  global.fetch = jest.fn(async (input, init) => {
    const url = String(input);
    if (url.startsWith("https://login.microsoftonline.com/"))
      return Response.json({ access_token: "fixture-token" });
    if (url.endsWith("/rpc/email_operational_prepare"))
      return Response.json({
        id: "fixture-operation",
        token: "fixture-lease",
        state: "creating",
        proceed: true,
        draftId: null,
        changeKey: null,
      });
    if (url.endsWith("/rpc/email_operational_update"))
      return Response.json(true);
    if (url.endsWith("/messages") && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      mockEmailDelivery(body);
      return Response.json({ id: "fixture-draft", changeKey: "one" });
    }
    if (url.endsWith("/messages/fixture-draft"))
      return Response.json({ isDraft: true, changeKey: "one" });
    if (url.endsWith("/messages/fixture-draft/send"))
      return new Response(null, { status: 202 });
    throw new Error(`Unexpected external email boundary: ${url}`);
  });
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: "staff-user" } } },
  });
  mockStaffSingle.mockResolvedValue({
    data: { id: "staff-1", role: "ADMINSTAFF", status: "ACTIVE" },
  });
  mockInvoiceSingle.mockResolvedValue({
    data: {
      stripe_invoice_id: "in_test",
      collection_method: "charge_automatically",
      student_id: "student-1",
    },
  });
  mockRetrieveInvoice.mockResolvedValue({
    id: "in_test",
    status: "open",
    number: "TEST-001",
    currency: "aud",
    total: 5000,
    created: 1790000000,
    hosted_invoice_url: "https://invoice.stripe.com/test-fixture",
    invoice_pdf: "https://invoice.stripe.com/test-fixture/pdf",
  });
  mockListLineItems.mockResolvedValue({
    data: [{ description: "Tutoring", amount: 5000 }],
  });
  mockBillingPrefs.mockResolvedValue({
    data: { invoice_email_to_student: true, invoice_email_to_parents: true },
  });
  mockStudentSingle.mockResolvedValue({
    data: { email: "student@example.test" },
  });
  mockParents.mockResolvedValue({
    data: [{ parent: { id: "parent-1", email: "parent@example.test" } }],
  });
  mockEmailDelivery.mockResolvedValue(undefined);
  mockRecordDomainEvent.mockResolvedValue({ error: null });
});

it.each(["charge_automatically", "send_invoice"])(
  "sends the Stripe-hosted %s invoice to configured recipients",
  async (collectionMethod) => {
    mockInvoiceSingle.mockResolvedValue({
      data: {
        stripe_invoice_id: "in_test",
        collection_method: collectionMethod,
        student_id: "student-1",
      },
    });
    const response = await POST(
      {
        headers: new Headers({ "idempotency-key": "fixture-intent" }),
      } as never,
      { params: Promise.resolve({ id: "invoice-id" }) },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        sent: ["student@example.test", "parent@example.test"],
      }),
    );
    expect(mockRetrieveInvoice).toHaveBeenCalledWith("in_test");
    expect(mockEmailDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        toRecipients: [{ emailAddress: { address: "student@example.test" } }],
        body: expect.objectContaining({
          content: expect.stringContaining(
            "https://invoice.stripe.com/test-fixture",
          ),
        }),
      }),
    );
  },
);

it("honors recipient preferences when notifying about an automatically charged invoice", async () => {
  mockBillingPrefs.mockResolvedValue({
    data: {
      invoice_email_to_student: false,
      invoice_email_to_parents: true,
    },
  });
  const response = await POST(
    { headers: new Headers({ "idempotency-key": "fixture-intent" }) } as never,
    { params: Promise.resolve({ id: "invoice-id" }) },
  );
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual(
    expect.objectContaining({ sent: ["parent@example.test"] }),
  );
  expect(mockEmailDelivery).toHaveBeenCalledTimes(1);
});

it("rejects sending when no recipients are configured", async () => {
  mockBillingPrefs.mockResolvedValue({
    data: {
      invoice_email_to_student: false,
      invoice_email_to_parents: false,
    },
  });
  const response = await POST(
    { headers: new Headers({ "idempotency-key": "fixture-intent" }) } as never,
    { params: Promise.resolve({ id: "invoice-id" }) },
  );
  expect(response.status).toBe(400);
  expect(mockEmailDelivery).not.toHaveBeenCalled();
});

it("rejects inactive admin staff without retrieving or sending the invoice", async () => {
  mockStaffSingle.mockResolvedValue({
    data: { id: "staff-1", role: "ADMINSTAFF", status: "INACTIVE" },
  });
  const response = await POST(
    { headers: new Headers({ "idempotency-key": "fixture-intent" }) } as never,
    { params: Promise.resolve({ id: "invoice-id" }) },
  );
  expect(response.status).toBe(403);
  expect(mockRetrieveInvoice).not.toHaveBeenCalled();
  expect(mockEmailDelivery).not.toHaveBeenCalled();
});
