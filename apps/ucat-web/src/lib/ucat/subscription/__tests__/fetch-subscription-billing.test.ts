import {
  fetchUcatSubscriptionInvoices,
  pickCurrentSubscription,
} from "@/lib/ucat/subscription/fetch-subscription-billing";
import type { UcatSubscriptionRow } from "@/lib/ucat/ucat-subscription";

type QueryChain = {
  select: jest.Mock<QueryChain, []>;
  eq: jest.Mock<QueryChain, []>;
  in: jest.Mock<QueryChain, []>;
  order: jest.Mock<QueryChain, []>;
  range: jest.Mock<QueryChain, []>;
  then: (resolve: (value: unknown) => unknown) => Promise<unknown>;
};

function subscription(
  id: string,
  status: string,
  updatedAt: string,
): UcatSubscriptionRow {
  return {
    id,
    status,
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    cancel_at: null,
    stripe_subscription_id: `sub_${id}`,
    stripe_price_id: null,
    plan_tier: "unlimited",
    billing_interval: "month",
    billing_recovery_invoice_id: null,
    billing_recovery_started_at: null,
    billing_recovery_next_attempt_at: null,
    billing_recovery_requires_action: false,
    created_at: updatedAt,
    updated_at: updatedAt,
  };
}

describe("pickCurrentSubscription", () => {
  it("keeps a past-due subscription current during Stripe recovery", () => {
    expect(
      pickCurrentSubscription([
        subscription("past", "past_due", "2026-07-12T10:00:00Z"),
      ]),
    ).toMatchObject({ id: "past", status: "past_due" });
  });

  it("does not let a newer canceled row hide a recoverable subscription", () => {
    expect(
      pickCurrentSubscription([
        subscription("canceled", "canceled", "2026-07-12T11:00:00Z"),
        subscription("past", "past_due", "2026-07-12T10:00:00Z"),
      ]),
    ).toMatchObject({ id: "past", status: "past_due" });
  });

  it("keeps unpaid visible for payment management without granting access", () => {
    expect(
      pickCurrentSubscription([
        subscription("unpaid", "unpaid", "2026-07-12T10:00:00Z"),
      ]),
    ).toMatchObject({ id: "unpaid", status: "unpaid" });
  });

  it("returns null when only terminal history exists", () => {
    expect(
      pickCurrentSubscription([
        subscription("canceled", "canceled", "2026-07-12T10:00:00Z"),
      ]),
    ).toBeNull();
  });
});

describe("fetchUcatSubscriptionInvoices", () => {
  it("batch-loads items for the complete invoice history", async () => {
    const invoices = [
      {
        id: "invoice-1",
        student_subscription_id: "subscription-1",
        billing_source: "subscription",
      },
      {
        id: "invoice-2",
        student_subscription_id: "subscription-1",
        billing_source: "subscription",
      },
    ];
    const items = [
      {
        invoice_id: "invoice-1",
        description: "First",
        subject_name: "UCAT",
        amount_cents: 100,
      },
      {
        invoice_id: "invoice-2",
        description: "Second",
        subject_name: "UCAT",
        amount_cents: 200,
      },
    ];
    const from = jest.fn((table: string) => {
      const result = table === "vstudent_invoices" ? invoices : items;
      const chain: QueryChain = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        in: jest.fn(() => chain),
        order: jest.fn(() => chain),
        range: jest.fn(() => chain),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: result, error: null }).then(resolve),
      };
      return chain;
    });

    const result = await fetchUcatSubscriptionInvoices({ from } as never, [
      "subscription-1",
    ]);

    expect(
      from.mock.calls.filter(([table]) => table === "vstudent_invoice_items"),
    ).toHaveLength(1);
    expect(result.map((invoice) => invoice.items)).toEqual([
      [expect.objectContaining({ description: "First" })],
      [expect.objectContaining({ description: "Second" })],
    ]);
  });
});
