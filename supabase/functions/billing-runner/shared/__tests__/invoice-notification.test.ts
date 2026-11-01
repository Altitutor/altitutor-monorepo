import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type Stripe from "npm:stripe@16.6.0";
import { loadStudentEmails } from "../data-loading.ts";
import { processStudentInvoicing } from "../student-processing.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const scenarios = [
  {
    name: "missing-both",
    student: null,
    parent: null,
    parentError: false,
    enabled: [true, true],
    expected: 0,
  },
  {
    name: "student-only",
    student: "student@example.test",
    parent: null,
    parentError: false,
    enabled: [true, true],
    expected: 1,
  },
  {
    name: "parent-only",
    student: null,
    parent: "parent@example.test",
    parentError: false,
    enabled: [true, true],
    expected: 1,
  },
  {
    name: "both-available",
    student: "student@example.test",
    parent: "parent@example.test",
    parentError: false,
    enabled: [true, true],
    expected: 2,
  },
  {
    name: "duplicate-contact",
    student: "same@example.test",
    parent: "same@example.test",
    parentError: false,
    enabled: [true, true],
    expected: 1,
  },
  {
    name: "parent-query-failed",
    student: null,
    parent: "parent@example.test",
    parentError: true,
    enabled: [true, true],
    expected: 0,
  },
  {
    name: "warning-store-failed",
    student: null,
    parent: null,
    parentError: false,
    enabled: [true, true],
    expected: 0,
  },
  {
    name: "missing-key-and-contacts",
    student: null,
    parent: null,
    parentError: false,
    enabled: [true, true],
    expected: 0,
  },
  {
    name: "both-disabled",
    student: "student@example.test",
    parent: "parent@example.test",
    parentError: false,
    enabled: [false, false],
    expected: 0,
  },
];
for (const fixture of scenarios) {
  Deno.test(`invoice recipient warning: ${fixture.name}`, async () => {
    const sent: string[] = [];
    const notices: Array<Record<string, unknown>> = [];
    const warnings: string[] = [];
    let finalized = false;
    let persisted = false;
    let itemsPersisted = false;
    const originalFetch = globalThis.fetch;
    const mailboxEnv = {
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-key",
      EMAIL_ENVIRONMENT: "production",
      EMAIL_M365_TENANT_ID: "synthetic-tenant",
      EMAIL_M365_CLIENT_ID: "synthetic-client",
      EMAIL_M365_CLIENT_SECRET: "synthetic-secret",
    };
    const previousEnv = new Map(
      Object.keys(mailboxEnv).map((key) => [key, Deno.env.get(key)]),
    );
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const invoice = {
      id: "in_synthetic",
      status: "paid",
      collection_method: "send_invoice",
      total: 0,
      amount_due: 0,
      amount_paid: 0,
      currency: "aud",
      created: 1792752000,
      status_transitions: { finalized_at: 1792752000, paid_at: 1792752000 },
    };
    const supabase = {
      from(table: string) {
        if (table === "staff") {
          const q = {
            select: () => q,
            eq: () => q,
            then: (resolve: (value: unknown) => unknown) =>
              Promise.resolve({
                data: [{ id: "admin-synthetic" }],
                error: null,
              }).then(resolve),
          };
          return q;
        }
        if (table === "notifications") {
          return {
            upsert: (rows: Array<Record<string, unknown>>) => {
              if (fixture.name === "warning-store-failed") {
                return Promise.resolve({
                  data: null,
                  error: new Error("Warning store unavailable"),
                });
              }
              notices.push(...rows);
              return Promise.resolve({ data: null, error: null });
            },
          };
        }
        if (table === "parents_students") {
          return {
            select: () =>
              Promise.resolve({
                data: fixture.parentError
                  ? null
                  : [
                      {
                        student_id: "student-synthetic",
                        parent: { email: fixture.parent },
                      },
                    ],
                error: fixture.parentError
                  ? {
                      code: "SYNTHETIC",
                      message: "Synthetic parent query failure",
                    }
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
        if (table === "invoice_items") {
          return {
            select: () => ({
              in: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
            upsert: () => {
              itemsPersisted = true;
              return Promise.resolve({ error: null });
            },
          };
        }
        if (table === "invoices") {
          const q = {
            select: () => q,
            eq: () => q,
            is: () => q,
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
            insert: () => {
              persisted = true;
              return {
                select: () => ({
                  single: () =>
                    Promise.resolve({
                      data: { id: "invoice-synthetic", status: "paid" },
                      error: null,
                    }),
                }),
              };
            },
          };
          return q;
        }
        throw new Error(`Unexpected DB boundary ${table}`);
      },
    } as unknown as SupabaseClient;
    const stripe = {
      customers: {
        retrieve: () =>
          Promise.resolve({
            id: "cus_synthetic",
            email: "legacy@example.test",
          }),
        update: () => {
          throw new Error("Unexpected customer write");
        },
      },
      invoices: {
        create: () => Promise.resolve({ ...invoice, status: "draft" }),
        finalizeInvoice: () => {
          finalized = true;
          return Promise.resolve(invoice);
        },
        retrieve: () => Promise.resolve(invoice),
        listLineItems: () => Promise.resolve({ data: [] }),
      },
      invoiceItems: { create: () => Promise.resolve({ id: "ii_synthetic" }) },
    } as unknown as Stripe;
    try {
      for (const [key, value] of Object.entries(mailboxEnv))
        Deno.env.set(key, value);
      globalThis.fetch = ((
        input: string | URL | Request,
        init?: RequestInit,
      ) => {
        const url = String(input);
        const json = (value: unknown) =>
          Promise.resolve(new Response(JSON.stringify(value), { status: 200 }));
        if (url.startsWith("https://login.microsoftonline.com/"))
          return json({ access_token: "synthetic-token" });
        if (url.endsWith("/rpc/email_operational_prepare"))
          return json({
            id: crypto.randomUUID(),
            token: crypto.randomUUID(),
            proceed: true,
            state: "creating",
            draftId: null,
            changeKey: null,
          });
        if (url.endsWith("/rpc/email_operational_update")) return json(true);
        if (
          url ===
            "https://graph.microsoft.com/v1.0/users/admin%40altitutor.com/messages" &&
          init?.method === "POST"
        ) {
          const body = JSON.parse(String(init.body));
          for (const recipient of body.toRecipients)
            sent.push(recipient.emailAddress.address);
          return json({ id: "email-synthetic", changeKey: "version-1" });
        }
        if (url.endsWith("/messages/email-synthetic") && init?.method === "GET")
          return json({ isDraft: true, changeKey: "version-1" });
        if (
          url.endsWith("/messages/email-synthetic/send") &&
          init?.method === "POST"
        )
          return Promise.resolve(new Response(null, { status: 202 }));
        throw new Error(
          `Unexpected email HTTP boundary: ${init?.method} ${url}`,
        );
      }) as typeof fetch;
      console.log = () => {};
      console.warn = (...values: unknown[]) => warnings.push(values.join(" "));
      console.error = (...values: unknown[]) => {
        if (fixture.name === "warning-store-failed") return;
        throw new Error(`Unexpected error: ${values.join(" ")}`);
      };
      const contacts = await loadStudentEmails(supabase);
      const result = await processStudentInvoicing({
        supabase,
        stripe,
        studentId: "student-synthetic",
        studentSessions: [
          {
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
          },
        ],
        invoiceDate: "2026-10-23",
        targetDate: new Date("2026-10-23T05:00:00Z"),
        pricingByBillingType: {
          STANDARD: { hourly_rate_cents: 0, currency: "AUD" },
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
            invoice_email_to_student: fixture.enabled[0],
            invoice_email_to_parents: fixture.enabled[1],
          },
        },
        ...contacts,
        isStripeTestKey: true,
        isStripeLiveKey: false,
        resendApiKey:
          fixture.name === "missing-key-and-contacts"
            ? undefined
            : "synthetic-key",
      });
      assert(
        finalized && persisted && itemsPersisted,
        "Did not reach actual finalized + persisted invoice lifecycle",
      );
      assert(
        result.invoiceId === "invoice-synthetic" && result.error === null,
        "Expected invoice success",
      );
      assert(
        sent.length === fixture.expected,
        `Unexpected recipient delivery count for ${fixture.name}`,
      );
      originalLog(
        JSON.stringify({
          scenario: fixture.name,
          finalized,
          persisted,
          itemsPersisted,
          sent: sent.length,
          emptyRecipientWarning: warnings.some((x) =>
            x.includes("No recipients configured"),
          ),
          returnedError: result.error,
        }),
      );
      const needsWarning =
        fixture.expected === 0 &&
        fixture.enabled.some(Boolean) &&
        fixture.name !== "warning-store-failed";
      assert(
        notices.length === (needsWarning ? 1 : 0),
        "Expected durable staff warning only when enabled delivery has no resolved recipients",
      );
      if (needsWarning) {
        assert(
          notices[0].action_url === "/invoices/invoice-synthetic",
          "Warning must open the persisted invoice",
        );
        assert(
          notices[0].app_scope === "staff_web",
          "Warning must reach staff inbox",
        );
        assert(
          String(notices[0].body).includes("resolved"),
          "Lookup uncertainty must not be reported as proof that contact details do not exist",
        );
        assert(
          notices[0].dedupe_key ===
            "invoice:no-email-recipient:invoice-synthetic:admin-synthetic",
          "Repeat warnings must share the existing unique notification key",
        );
      }
    } finally {
      globalThis.fetch = originalFetch;
      for (const [key, value] of previousEnv) {
        if (value === undefined) Deno.env.delete(key);
        else Deno.env.set(key, value);
      }
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }
  });
}
