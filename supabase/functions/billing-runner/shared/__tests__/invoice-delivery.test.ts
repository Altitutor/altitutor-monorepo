import { expect } from "jsr:@std/expect";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type Stripe from "npm:stripe@16.6.0";
import { loadStudentEmails } from "../data-loading.ts";
import { processStudentInvoicing } from "../student-processing.ts";

interface Fixture {
  student?: string;
  parent?: string;
  enabled?: [boolean, boolean];
  total?: number;
  parentQueryFails?: boolean;
  noticeFails?: "throw" | "result";
  resendApiKey?: string;
}

// Only external boundaries are substituted. The real loading, pricing, invoice
// finalization/persistence and notification path run together, as in the incident.
function billingFixture(fixture: Fixture = {}) {
  const state = {
    finalized: false,
    persisted: false,
    itemsPersisted: false,
    sent: [] as string[],
    notices: [] as Record<string, unknown>[],
    errors: [] as string[],
  };
  const total = fixture.total ?? 0;
  const invoice = {
    id: "in_synthetic",
    status: total === 0 ? "paid" : "open",
    collection_method: "send_invoice",
    total,
    amount_due: total,
    amount_paid: 0,
    currency: "aud",
    created: 1792752000,
    status_transitions: {
      finalized_at: 1792752000,
      paid_at: total === 0 ? 1792752000 : null,
    },
  };
  const supabase = {
    from(table: string) {
      if (table === "parents_students") {
        return {
          select: () =>
            Promise.resolve({
              data: fixture.parentQueryFails ? null : [{
                student_id: "student-synthetic",
                parent: { email: fixture.parent },
              }],
              error: fixture.parentQueryFails
                ? { code: "SYNTHETIC", message: "private parent query error" }
                : null,
            }),
        };
      }
      if (table === "students") {
        return {
          select: () =>
            Promise.resolve({
              data: [{ id: "student-synthetic", email: fixture.student }],
              error: null,
            }),
        };
      }
      if (table === "staff") {
        const filters: Record<string, string> = {};
        const query = {
          select: () => query,
          eq: (column: string, value: string) => {
            filters[column] = value;
            return query;
          },
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve(resolve({
              data: [
                { id: "admin-one", role: "ADMINSTAFF", status: "ACTIVE" },
                { id: "admin-two", role: "ADMINSTAFF", status: "ACTIVE" },
                { id: "tutor", role: "TUTOR", status: "ACTIVE" },
                {
                  id: "inactive-admin",
                  role: "ADMINSTAFF",
                  status: "INACTIVE",
                },
              ].filter((staff) =>
                Object.entries(filters).every(([key, value]) =>
                  staff[key as keyof typeof staff] === value
                )
              ),
              error: null,
            })),
        };
        return query;
      }
      if (table === "notifications") {
        return {
          upsert: (
            rows: Record<string, unknown>[],
            options: { onConflict: string; ignoreDuplicates: boolean },
          ) => {
            if (fixture.noticeFails === "throw") {
              throw new Error("private notification storage error");
            }
            if (fixture.noticeFails === "result") {
              return Promise.resolve({
                error: { message: "private notification storage error" },
              });
            }
            for (const row of rows) {
              const existing = state.notices.find((notice) =>
                notice[options.onConflict] === row[options.onConflict]
              );
              if (!existing) state.notices.push(row);
              else if (!options.ignoreDuplicates) Object.assign(existing, row);
            }
            return Promise.resolve({ error: null });
          },
        };
      }
      if (table === "invoice_items") {
        return {
          select: () => ({
            in: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
          upsert: () => {
            state.itemsPersisted = true;
            return Promise.resolve({ error: null });
          },
        };
      }
      if (table === "invoices") {
        const query = {
          select: () => query,
          eq: () => query,
          is: () => query,
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          insert: () => {
            state.persisted = true;
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: "invoice-synthetic", status: invoice.status },
                    error: null,
                  }),
              }),
            };
          },
        };
        return query;
      }
      throw new Error(`Unexpected database boundary: ${table}`);
    },
  } as unknown as SupabaseClient;
  const stripe = {
    customers: {
      retrieve: () =>
        Promise.resolve({ id: "cus_synthetic", email: "legacy@example.test" }),
    },
    invoices: {
      create: () => Promise.resolve({ ...invoice, status: "draft" }),
      finalizeInvoice: () => {
        state.finalized = true;
        return Promise.resolve(invoice);
      },
      retrieve: () => Promise.resolve(invoice),
      listLineItems: () => Promise.resolve({ data: [] }),
    },
    invoiceItems: { create: () => Promise.resolve({ id: "ii_synthetic" }) },
  } as unknown as Stripe;

  async function run() {
    const original = {
      fetch: globalThis.fetch,
      log: console.log,
      warn: console.warn,
      error: console.error,
    };
    try {
      globalThis.fetch =
        ((_input: string | URL | Request, init?: RequestInit) => {
          state.sent.push(JSON.parse(String(init?.body)).to);
          return Promise.resolve(
            new Response(JSON.stringify({ id: "email-synthetic" }), {
              status: 200,
            }),
          );
        }) as typeof fetch;
      console.log = console.warn = () => {};
      console.error = (...values: unknown[]) => {
        state.errors.push(values.join(" "));
      };
      const contacts = await loadStudentEmails(supabase);
      const [toStudent, toParents] = fixture.enabled ?? [true, true];
      const result = await processStudentInvoicing({
        supabase,
        stripe,
        studentId: "student-synthetic",
        studentSessions: [{
          student_id: "student-synthetic",
          sessions_students_id: "ss-synthetic",
          subject: { long_name: "Synthetic subject" },
          session: {
            id: "session-synthetic",
            start_at: "2026-10-23T05:00:00Z",
            end_at: "2026-10-23T06:00:00Z",
            subject_id: "subject-synthetic",
            billing_type: "STANDARD",
          },
        }],
        invoiceDate: "2026-10-23",
        targetDate: new Date("2026-10-23T05:00:00Z"),
        pricingByBillingType: {
          STANDARD: { hourly_rate_cents: total, currency: "AUD" },
        },
        overridesBySubjectAndBilling: {},
        pricingOverrides: [],
        subsidies: [],
        classById: {},
        subjectById: { "subject-synthetic": { name: "Synthetic subject" } },
        billingByStudent: {
          "student-synthetic": {
            student_id: "student-synthetic",
            stripe_customer_id: "cus_synthetic",
            payment_methods: [],
            auto_bill_enabled: false,
            invoice_email_to_student: toStudent,
            invoice_email_to_parents: toParents,
          },
        },
        ...contacts,
        isStripeTestKey: true,
        isStripeLiveKey: false,
        resendApiKey: fixture.resendApiKey ?? "synthetic-key",
      });
      expect(result).toEqual({ invoiceId: "invoice-synthetic", error: null });
      expect([state.finalized, state.persisted, state.itemsPersisted]).toEqual([
        true,
        true,
        true,
      ]);
    } finally {
      globalThis.fetch = original.fetch;
      console.log = original.log;
      console.warn = original.warn;
      console.error = original.error;
    }
  }
  return { state, run };
}

Deno.test("paid zero-total invoice with enabled delivery and no contacts gives active admin staff an actionable warning", async () => {
  const { state, run } = billingFixture();
  await run();
  expect(state.sent).toEqual([]);
  expect(state.notices.map((notice) => notice.staff_id)).toEqual([
    "admin-one",
    "admin-two",
  ]);
  expect(state.notices[0]).toMatchObject({
    app_scope: "staff_web",
    notification_type: "billing.invoice_email_missing_recipients",
    action_url: "/invoices/invoice-synthetic",
    priority: "important",
  });
  expect(state.notices[0].body).toContain("contact");
  expect(state.notices[0].body).toContain("delivery");
  expect(JSON.stringify(state.notices)).not.toContain("legacy@example.test");
});

for (
  const fixture of [
    { student: "student@example.test" },
    { parent: "parent@example.test" },
    { student: "same@example.test", parent: "same@example.test" },
  ]
) {
  Deno.test(`available configured contact receives invoice without a missing-recipient warning: ${JSON.stringify(fixture)}`, async () => {
    const { state, run } = billingFixture(fixture);
    await run();
    expect(state.sent).toEqual([fixture.student ?? fixture.parent]);
    expect(state.notices).toEqual([]);
  });
}

Deno.test("both delivery preferences disabled intentionally creates no warning or email", async () => {
  const { state, run } = billingFixture({ enabled: [false, false] });
  await run();
  expect(state.sent).toEqual([]);
  expect(state.notices).toEqual([]);
});

Deno.test("an available contact excluded by preferences cannot prevent the warning or receive an email", async () => {
  const { state, run } = billingFixture({
    student: "student@example.test",
    enabled: [false, true],
  });
  await run();
  expect(state.sent).toEqual([]);
  expect(state.notices).toHaveLength(2);
});

Deno.test("an unpaid invoice also warns and never falls back to the legacy Stripe address", async () => {
  const { state, run } = billingFixture({ total: 7500 });
  await run();
  expect(state.sent).toEqual([]);
  expect(state.notices).toHaveLength(2);
});

Deno.test("unavailable parent lookup produces an actionable warning without claiming a proven contact-data cause", async () => {
  const { state, run } = billingFixture({
    parent: "parent@example.test",
    parentQueryFails: true,
  });
  await run();
  expect(state.sent).toEqual([]);
  expect(state.notices).toHaveLength(2);
  expect(JSON.stringify(state.notices)).not.toContain(
    "private parent query error",
  );
});

Deno.test("missing-recipient warning does not depend on email transport configuration", async () => {
  const { state, run } = billingFixture({ resendApiKey: "" });
  await run();
  expect(state.notices).toHaveLength(2);
});

Deno.test("repeated processing cannot duplicate or reopen a dismissed staff warning", async () => {
  const { state, run } = billingFixture();
  await run();
  state.notices[0].dismissed_at = "2026-10-24T00:00:00Z";
  await run();
  expect(state.notices).toHaveLength(2);
  expect(state.notices[0].dismissed_at).toBe("2026-10-24T00:00:00Z");
});

for (const noticeFails of ["throw", "result"] as const) {
  Deno.test(`warning storage failure (${noticeFails}) stays observable without retrying financial success or leaking raw errors`, async () => {
    const { state, run } = billingFixture({ noticeFails });
    await run();
    expect(state.notices).toEqual([]);
    expect(state.errors.join(" ")).toContain(
      "staff warning could not be stored",
    );
    expect(state.errors.join(" ")).not.toContain(
      "private notification storage error",
    );
    expect(state.sent).toEqual([]);
  });
}
