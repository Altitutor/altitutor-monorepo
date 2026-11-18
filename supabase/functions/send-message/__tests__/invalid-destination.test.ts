// Throwaway incident reproduction: external persistence/provider boundaries only.
// No listener, remote DB, provider request, real phone, content or credential.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { assertEquals } from "jsr:@std/assert";
import { processExecution } from "../../activity-processor/execution.ts";

type Row = Record<string, unknown>;
type Handler = (request: Request) => Response | Promise<Response>;
let sendHandler: Handler | undefined;
Object.defineProperty(Deno, "serve", {
  value: (handler: Handler) => {
    sendHandler = handler;
    return {};
  },
});
for (
  const [name, value] of Object.entries({
    SENTRY_DISABLED: "true",
    SENTRY_DSN: "",
    SENTRY_TEST_OPT_IN: "false",
    SUPABASE_URL: "http://synthetic.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-key",
    TWILIO_ACCOUNT_SID: "ACsynthetic",
    TWILIO_AUTH_TOKEN: "synthetic-token",
    TWILIO_API_KEY_SID: "",
    TWILIO_API_KEY_SECRET: "",
  })
) Deno.env.set(name, value);
await import("../index.ts");
if (!sendHandler) {
  throw new Error("send-message did not register its real handler");
}

function fixture(
  rejectedRecipients: number,
  providerCode = 21211,
  options: { recovery?: boolean; loseProviderResponse?: boolean } = {},
) {
  const db: Record<string, Row[]> = {
    automation_executions: [{
      id: "execution",
      rule_id: "rule",
      domain_event_id: "event",
      status: "PENDING",
      attempt_count: 0,
    }],
    automation_rules: [{ id: "rule", enabled: true, conditions: {} }],
    automation_actions: [{
      id: "action",
      rule_id: "rule",
      order_index: 0,
      action_type: "SEND_MESSAGE",
      action_config: {
        message_content: "Synthetic notice",
        recipients: { type: "student_and_parents" },
        owned_number_id: "sender",
      },
    }],
    domain_events: [{
      id: "event",
      event_name: "student.created",
      subject_type: "student",
      subject_id: "student",
      payload: {},
    }],
    domain_event_entities: [{
      domain_event_id: "event",
      entity_type: "student",
      entity_id: "student",
      role: "subject",
    }],
    students: [{
      id: "student",
      first_name: "Synthetic",
      last_name: "Student",
      deleted_at: null,
    }],
    parents_students: [{ student_id: "student", parent_id: "parent" }],
    contacts: [
      {
        id: "recipient-0",
        student_id: "student",
        parent_id: null,
        contact_type: "STUDENT",
        is_opted_out: false,
        phone_e164: "+15555550100",
        email: null,
      },
      {
        id: "recipient-1",
        student_id: null,
        parent_id: "parent",
        contact_type: "PARENT",
        is_opted_out: false,
        phone_e164: "+15555550101",
        email: null,
      },
    ],
    owned_numbers: [{
      id: "sender",
      phone_e164: "+15555550199",
      provider: "TWILIO",
      sender_type: "PHONE",
    }],
    automation_message_action_skips: [],
    automation_message_deliveries: [],
    messages: [],
    conversations: [],
    classes_students: [],
  };
  const rejectedPhones = new Set(
    db.contacts.slice(0, rejectedRecipients).map((row) => row.phone_e164),
  );
  const providerAttempts = [0, 0];
  const edgeStatuses: number[] = [];
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    if (url.hostname === "api.twilio.com") {
      const form = new URLSearchParams(await req.text());
      const index = db.contacts.findIndex((row) =>
        row.phone_e164 === form.get("To")
      );
      if (index < 0) throw new Error("Unexpected synthetic destination");
      providerAttempts[index] = (providerAttempts[index] ?? 0) + 1;
      if (options.loseProviderResponse) {
        throw new TypeError("Synthetic lost provider response");
      }
      return rejectedPhones.has(form.get("To"))
        ? Response.json({
          code: providerCode,
          message: "The synthetic To number is not a valid phone number",
          status: 400,
        }, { status: 400 })
        : Response.json({ sid: "SMsynthetic", status: "queued" });
    }
    if (url.hostname !== "synthetic.invalid") {
      throw new Error("Unexpected network boundary");
    }
    if (url.pathname === "/functions/v1/send-message") {
      const response = await sendHandler!(req);
      edgeStatuses.push(response.status);
      return response;
    }
    const table = url.pathname.split("/").at(-1)!;
    if (table === "claim_automation_message_send") {
      return Response.json({
        dispatch: true,
        recovery: options.recovery ?? false,
      });
    }
    if (table === "claim_automation_execution") {
      const args = await req.json() as { p_execution_id: string };
      const execution = db.automation_executions.find((row) =>
        row.id === args.p_execution_id
      )!;
      if (
        execution.status === "COMPLETED" || Number(execution.attempt_count) >= 8
      ) return Response.json([]);
      execution.attempt_count = Number(execution.attempt_count) + 1;
      execution.status = "PROCESSING";
      return Response.json([{ ...execution }]);
    }
    const allRows = db[table];
    if (!allRows) throw new Error(`Unmodelled database boundary ${table}`);
    const matches = (row: Row) =>
      [...url.searchParams].every(([column, expression]) => {
        if (["select", "order", "limit"].includes(column)) return true;
        if (expression.startsWith("eq.")) {
          return String(row[column]) === expression.slice(3);
        }
        if (expression === "is.null") return row[column] == null;
        if (expression.startsWith("in.(")) {
          return expression.slice(4, -1).split(",").includes(
            String(row[column]),
          );
        }
        throw new Error(`Unmodelled filter ${column}`);
      });
    let rows = allRows.filter(matches);
    if (req.method === "POST") {
      const inserted = await req.json() as Row;
      if (
        table === "automation_message_deliveries" &&
        allRows.some((row) =>
          ["execution_id", "action_id", "contact_id", "student_id"].every(
            (column) => row[column] === inserted[column],
          )
        )
      ) {
        return Response.json({
          code: "23505",
          message: "Synthetic duplicate delivery",
        }, { status: 409 });
      }
      const row: Row = {
        ...(table === "automation_message_deliveries"
          ? {
            recipient_student_id: db.contacts.find((row) =>
              row.id === inserted.contact_id
            )?.student_id,
            recipient_parent_id: db.contacts.find((row) =>
              row.id === inserted.contact_id
            )?.parent_id,
          }
          : {}),
        id: `${table}-${allRows.length}`,
        ...(table === "automation_message_deliveries"
          ? { attempt_count: 1 }
          : {}),
        ...inserted,
      };
      allRows.push(row);
      rows = [row];
    } else if (req.method === "PATCH") {
      const patch = await req.json() as Row;
      rows.forEach((row) => {
        Object.assign(row, patch);
        // External database boundary implements the separately tested status trigger.
        if (table === "messages" && patch.error_code === 21211) {
          for (
            const delivery of db.automation_message_deliveries.filter((d) =>
              d.message_id === row.id
            )
          ) {
            Object.assign(delivery, {
              terminal_failure: true,
              status: "FAILED",
            });
          }
        }
      });
    }
    if (
      req.headers.get("accept")?.includes("application/vnd.pgrst.object+json")
    ) {
      if (rows.length !== 1) {
        return Response.json({
          code: "PGRST116",
          message: "Synthetic singleton missing",
        }, { status: 406 });
      }
      return Response.json(rows[0]);
    }
    return Response.json(rows);
  };
  const client = createClient("http://synthetic.invalid", "synthetic-key", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { db, client, providerAttempts, edgeStatuses };
}

Deno.test("Twilio rejection retains its structured provider code", async () => {
  const fetchBefore = globalThis.fetch;
  try {
    const { db, client } = fixture(1);
    try {
      await processExecution(client, "execution");
    } catch { /* rejected recipient */ }
    assertEquals(db.messages[0].error_code, 21211);
  } finally {
    globalThis.fetch = fetchBefore;
  }
});

Deno.test("unchanged 21211 destination stops retrying without repeating its accepted companion", async () => {
  const fetchBefore = globalThis.fetch;
  try {
    const { db, client, providerAttempts } = fixture(1);
    for (let i = 0; i < 8; i++) await processExecution(client, "execution");
    assertEquals(providerAttempts, [1, 1]);
    assertEquals(db.automation_message_deliveries[0].terminal_failure, true);
    assertEquals(db.messages[0].error_code, 21211);
    assertEquals(db.automation_executions[0].status, "COMPLETED");
  } finally {
    globalThis.fetch = fetchBefore;
  }
});
Deno.test("valid pairs retain delivery behavior", async () => {
  const fetchBefore = globalThis.fetch;
  try {
    const { db, client, providerAttempts } = fixture(0);
    await processExecution(client, "execution");
    assertEquals(providerAttempts, [1, 1]);
    assertEquals(db.messages.map((row) => row.status), ["SENDING", "SENDING"]);
  } finally {
    globalThis.fetch = fetchBefore;
  }
});
Deno.test("a retry after contact replacement cannot automatically replay terminal old content", async () => {
  const fetchBefore = globalThis.fetch;
  try {
    const { db, client, providerAttempts } = fixture(1);
    await processExecution(client, "execution");
    // A separate later action can retry this execution; model that durable claim boundary.
    db.automation_executions[0].status = "FAILED";
    const contact = db.contacts[0];
    db.contacts.push({
      ...contact,
      id: "corrected-contact",
      phone_e164: "+15555550200",
    });
    contact.student_id = null;
    contact.contact_type = "LEAD";
    await processExecution(client, "execution");
    assertEquals(providerAttempts, [1, 1]);
    assertEquals(db.messages.length, 2);
    assertEquals(db.messages[0].status, "FAILED");
  } finally {
    globalThis.fetch = fetchBefore;
  }
});
Deno.test("other provider errors remain retryable", async () => {
  const fetchBefore = globalThis.fetch;
  try {
    const { client, providerAttempts } = fixture(1, 21614);
    for (let i = 0; i < 2; i++) {
      try {
        await processExecution(client, "execution");
      } catch { /* retryable */ }
    }
    assertEquals(providerAttempts, [2, 1]);
  } finally {
    globalThis.fetch = fetchBefore;
  }
});

Deno.test("lost recovery provider response is unconfirmed rather than retryable failure", async () => {
  const fetchBefore = globalThis.fetch;
  try {
    const { db, client } = fixture(0, 21211, {
      recovery: true,
      loseProviderResponse: true,
    });
    try {
      await processExecution(client, "execution");
    } catch { /* unconfirmed sends */ }
    assertEquals(db.messages.map((row) => row.status), [
      "AMBIGUOUS",
      "AMBIGUOUS",
    ]);
  } finally {
    globalThis.fetch = fetchBefore;
  }
});

Deno.test("new automation can reach a corrected destination without recovering old content", async () => {
  const fetchBefore = globalThis.fetch;
  try {
    const { db, client, providerAttempts } = fixture(1);
    await processExecution(client, "execution");
    db.contacts[0].phone_e164 = "+15555550200";
    db.automation_executions.push({
      ...db.automation_executions[0],
      id: "new-execution",
      status: "PENDING",
      attempt_count: 0,
    });
    await processExecution(client, "new-execution");
    assertEquals(providerAttempts, [2, 2]);
    assertEquals(db.messages.length, 4);
    assertEquals(db.messages[0].status, "FAILED");
    assertEquals(db.automation_executions[1].status, "COMPLETED");
  } finally {
    globalThis.fetch = fetchBefore;
  }
});
