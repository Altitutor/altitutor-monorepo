import { assertEquals, assertStringIncludes } from "jsr:@std/assert";

// Capture the production registration; exercise its real parser, SDK and dispatch
// without opening a listener or contacting a database/provider.
const registration: {
  handler?: (request: Request) => Response | Promise<Response>;
} = {};
const originalServe = Object.getOwnPropertyDescriptor(Deno, "serve")!;
const previousDisabled = Deno.env.get("SENTRY_DISABLED");
Deno.env.set("SENTRY_DISABLED", "true");
Object.defineProperty(Deno, "serve", {
  configurable: true,
  value(handler: (request: Request) => Response | Promise<Response>) {
    registration.handler = handler;
  },
});
try {
  await import("./index.ts");
} finally {
  Object.defineProperty(Deno, "serve", originalServe);
  if (previousDisabled === undefined) Deno.env.delete("SENTRY_DISABLED");
  else Deno.env.set("SENTRY_DISABLED", previousDisabled);
}

async function invoke(
  payload: unknown,
  authorized = true,
  diagnosticSinkFails = false,
) {
  const previousEnv = new Map(
    ["IMESSAGE_WEBHOOK_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
      .map((name) => [name, Deno.env.get(name)]),
  );
  Deno.env.set("IMESSAGE_WEBHOOK_SECRET", "fixture-secret");
  Deno.env.set("SUPABASE_URL", "http://database.invalid");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fixture-service-key");
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const logs: unknown[][] = [];
  const writes: Array<{ table: string; body: unknown }> = [];
  globalThis.fetch = (input, init) => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").at(-1)!;
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    if (init?.method === "POST" || init?.method === "PATCH") {
      writes.push({ table, body });
    }
    let result: unknown = null;
    if (table === "owned_numbers") {
      result = { id: "owned-fixture", phone_e164: "+61400000000" };
    } else if (table === "imessage_events" && init?.method === "POST") {
      result = { id: "inbox-fixture", processed_at: null };
    }
    return Promise.resolve(Response.json(result));
  };
  console.error = (...args) => {
    if (diagnosticSinkFails && args[0] === "[DEBUG-imessage-participants-v1]") {
      throw new Error("diagnostic sink unavailable");
    }
    logs.push(args);
  };
  try {
    if (!registration.handler) {
      throw new Error("Inbound handler not registered");
    }
    const response = await registration.handler(
      new Request("http://inbound.invalid", {
        method: "POST",
        headers: {
          Authorization: authorized
            ? "Bearer fixture-secret"
            : "Bearer invalid",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }),
    );
    return {
      status: response.status,
      body: await response.json(),
      logs,
      writes,
    };
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    for (const [name, value] of previousEnv) {
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
}

Deno.test("missing individual participants remain failed and replayable", async () => {
  const result = await invoke({
    EventType: "new-message",
    MessageGuid: "fixture-guid",
    Body: "private fixture body",
    RawPayload: { data: { handle: { address: "private@example.test" } } },
  });
  assertEquals(result.status, 500);
  assertEquals(
    result.body.error,
    "Individual message missing sender/recipient",
  );
  assertEquals(result.writes[0].table, "imessage_events");
  assertEquals(result.writes.at(-1)?.body, {
    processing_error: "Individual message missing sender/recipient",
  });
  assertEquals(
    result.writes.some((write) => write.table === "messages"),
    false,
  );
  const diagnostic = result.logs.find(([tag]) =>
    tag === "[DEBUG-imessage-participants-v1]"
  );
  assertEquals(diagnostic?.[1], {
    version: 1,
    event_type: "new-message",
    source_event_type: "new-message",
    reason: "individual_participant_missing",
    is_from_me: false,
    is_group: false,
    has_guid: true,
    has_from: false,
    has_to: false,
    has_chat_id: false,
    raw_data_present: true,
    raw_has_handle_address: true,
    raw_has_from: false,
    raw_has_to: false,
    raw_has_chat_id: false,
    raw_has_chat_entries: false,
  });
  assertStringIncludes(
    JSON.stringify(result.logs),
    "individual_participant_missing",
  );
  assertEquals(JSON.stringify(result.logs).includes("private"), false);
});

Deno.test("omitted upstream participants are distinguishable from nested handles", async () => {
  const result = await invoke({ type: "message", guid: "fixture-guid" });
  assertEquals(result.status, 500);
  const diagnostic = result.logs.find(([tag]) =>
    tag === "[DEBUG-imessage-participants-v1]"
  )?.[1];
  assertEquals(
    diagnostic && (diagnostic as Record<string, unknown>).raw_data_present,
    false,
  );
  assertEquals(
    diagnostic &&
      (diagnostic as Record<string, unknown>).raw_has_handle_address,
    false,
  );
});

Deno.test("group chat absence captures only fixed categories and booleans", async () => {
  const result = await invoke({
    EventType: "reconciliation-message",
    MessageGuid: "secret-guid",
    IsFromMe: true,
    IsGroupChat: true,
    From: "secret-from",
    To: "secret-to",
    connectorId: "secret-connector",
    Body: "secret-message",
    Attachments: [{
      url: "https://secret.invalid/token",
      filename: "secret-file",
    }],
    rawPayload: {
      data: {
        from: "secret-from",
        to: "secret-to",
        chats: [{ guid: "secret-chat" }],
      },
    },
  });
  assertEquals(result.status, 500);
  assertEquals(result.body.error, "Group message missing ChatGuid/ChatId");
  const diagnostic = result.logs.find(([tag]) =>
    tag === "[DEBUG-imessage-participants-v1]"
  )?.[1] as Record<string, unknown>;
  assertEquals(diagnostic.reason, "group_chat_missing");
  assertEquals(diagnostic.is_from_me, true);
  assertEquals(diagnostic.raw_has_from, true);
  assertEquals(diagnostic.raw_has_to, true);
  assertEquals(diagnostic.raw_has_chat_entries, true);
  assertEquals(JSON.stringify(result.logs).includes("secret"), false);
});

Deno.test("a failed diagnostic sink preserves the original failure and replay state", async () => {
  const result = await invoke(
    { type: "new-message", guid: "fixture-guid" },
    true,
    true,
  );
  assertEquals(result.status, 500);
  assertEquals(
    result.body.error,
    "Individual message missing sender/recipient",
  );
  assertEquals(result.writes.at(-1)?.body, {
    processing_error: "Individual message missing sender/recipient",
  });
});

Deno.test("unauthorized payloads cannot trigger participant diagnostics or inbox writes", async () => {
  const result = await invoke(
    { type: "new-message", guid: "fixture-guid" },
    false,
  );
  assertEquals(result.status, 401);
  assertEquals(result.logs, []);
  assertEquals(result.writes, []);
});

Deno.test("ignored system events complete without participant diagnostics", async () => {
  const result = await invoke({ type: "private-unknown-type" });
  assertEquals(result.status, 200);
  assertEquals(result.logs, []);
});
