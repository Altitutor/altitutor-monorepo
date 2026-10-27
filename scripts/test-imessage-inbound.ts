/** Real HTTP/SDK/Postgres contracts. Run only against a verified disposable DB. */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { assert, assertEquals } from "jsr:@std/assert";

if (Deno.env.get("ALTITUTOR_OWNED_DB_INNER") !== "1") {
  throw new Error("Run under scripts/owned_database.py run");
}
const url = Deno.env.get("SUPABASE_URL")!;
if (new URL(url).hostname !== "127.0.0.1") {
  throw new Error("Owned loopback database required");
}
const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
Deno.env.set("IMESSAGE_WEBHOOK_SECRET", "synthetic-inbound-contract");
Deno.env.set("SENTRY_DISABLED", "true");
Deno.env.delete("SENTRY_DSN");

let inbound: ((request: Request) => Promise<Response>) | undefined;
const serve = Deno.serve;
Deno.serve = ((callback: typeof inbound) => {
  inbound = callback;
  return {};
}) as unknown as typeof Deno.serve;
try {
  await import("../supabase/functions/imessage-inbound/index.ts");
} finally {
  Deno.serve = serve;
}
if (!inbound) throw new Error("Missing inbound handler");
const handler = inbound;

async function insert(table: string, values: Record<string, unknown>) {
  const { data, error } = await db.from(table).insert(values).select().single();
  if (error) throw error;
  return data;
}
async function row(table: string, id: string) {
  const { data, error } = await db.from(table).select("*").eq("id", id)
    .single();
  if (error) throw error;
  return data;
}
const { data: owned, error: ownedError } = await db.from("owned_numbers")
  .select("id,phone_e164").eq("provider", "IMESSAGE").limit(1).single();
if (ownedError) throw ownedError;
const { data: staff, error: staffError } = await db.from("staff")
  .select("id").eq("role", "ADMINSTAFF").eq("status", "ACTIVE").limit(1)
  .single();
if (staffError) throw staffError;
const contact = await insert("contacts", {
  phone_e164: "+61400999245",
  contact_type: "OTHER",
});
const conversation = await insert("conversations", {
  contact_id: contact.id,
  owned_number_id: owned.id,
});
const date = "2026-10-25T20:00:00.000Z";
const base = {
  conversation_id: conversation.id,
  direction: "OUTBOUND",
  body: "Original staff reply",
  from_number_e164: owned.phone_e164,
  to_number_e164: contact.phone_e164,
  status: "SENT",
  created_at: date,
};
function event(guid: string, tempGuid?: string) {
  return {
    EventType: "new-message",
    MessageGuid: guid,
    TempGuid: tempGuid,
    IsFromMe: true,
    To: contact.phone_e164,
    Date: date,
    Body: "Provider copy",
    Attachments: [{ storageUrl: "https://synthetic.invalid/shared.png" }],
  };
}
async function send(payload: Record<string, unknown>) {
  const response = await handler(
    new Request("http://localhost/imessage-inbound", {
      method: "POST",
      headers: {
        Authorization: "Bearer synthetic-inbound-contract",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }),
  );
  return { status: response.status, body: await response.json() };
}

const guid = crypto.randomUUID();
const tempGuid = crypto.randomUUID();
const provider = await insert("messages", {
  ...base,
  body: "Provider copy",
  imessage_guid: guid,
  status: "DELIVERED",
});
const original = await insert("messages", {
  ...base,
  imessage_temp_guid: tempGuid,
  status: "READ",
  created_by_staff_id: staff.id,
});
await insert("message_attachments", {
  message_id: provider.id,
  storage_url: "https://synthetic.invalid/shared.png",
});
await insert("message_attachments", {
  message_id: original.id,
  storage_url: "https://synthetic.invalid/shared.png",
});
const attachment = await insert("message_attachments", {
  message_id: provider.id,
  storage_url: "https://synthetic.invalid/provider.png",
});
const command = await insert("imessage_commands", {
  command_type: "mark_chat_read",
  message_id: provider.id,
  conversation_id: conversation.id,
  idempotency_key: crypto.randomUUID(),
});
const rule = await insert("automation_rules", {
  name: "Synthetic inbound history",
  event_names: ["student.created"],
  entity_type: "students",
  enabled: false,
});
const action = await insert("automation_actions", {
  rule_id: rule.id,
  action_type: "SEND_MESSAGE",
  action_config: {},
});
const execution = await insert("automation_executions", {
  rule_id: rule.id,
  entity_type: "students",
  entity_id: crypto.randomUUID(),
  event_type: "synthetic",
  source_key: crypto.randomUUID(),
});
const delivery = await insert("automation_message_deliveries", {
  execution_id: execution.id,
  action_id: action.id,
  contact_id: contact.id,
  message_id: provider.id,
  status: "QUEUED",
});
const resend = await insert("messages", {
  ...base,
  created_at: "2026-10-24T20:00:00.000Z",
  resent_from_message_id: provider.id,
});
const { error: readError } = await db.from("conversation_reads").upsert({
  conversation_id: conversation.id,
  staff_id: staff.id,
  last_read_message_id: provider.id,
  auto_read_message_id: provider.id,
  last_read_at: date,
}, { onConflict: "conversation_id,staff_id" });
if (readError) throw readError;
const { error: tipError } = await db.from("conversations").update({
  last_message_id: provider.id,
  last_message_at: date,
}).eq("id", conversation.id);
if (tipError) throw tipError;

const eventId = crypto.randomUUID();
const results = await Promise.all(
  Array.from(
    { length: 5 },
    () => send({ ...event(guid, tempGuid), EventId: eventId }),
  ),
);
assertEquals(results.map((x) => x.status), [200, 200, 200, 200, 200]);
const { data: messages, error: messagesError } = await db.from("messages")
  .select("*").or(`imessage_guid.eq.${guid},imessage_temp_guid.eq.${tempGuid}`);
if (messagesError) throw messagesError;
assertEquals(messages?.length, 1);
assertEquals(messages![0].id, original.id);
assertEquals(messages![0].body, "Original staff reply");
assertEquals(messages![0].created_by_staff_id, staff.id);
assertEquals(messages![0].status, "READ");
assertEquals(
  (await row("message_attachments", attachment.id)).message_id,
  original.id,
);
assertEquals(
  (await row("imessage_commands", command.id)).message_id,
  original.id,
);
assertEquals(
  (await row("messages", resend.id)).resent_from_message_id,
  original.id,
);
assertEquals(
  (await row("automation_message_deliveries", delivery.id)).message_id,
  original.id,
);
const { data: reads, error: readsError } = await db.from("conversation_reads")
  .select("*").eq("conversation_id", conversation.id).eq("staff_id", staff.id)
  .single();
if (readsError) throw readsError;
assertEquals(reads.last_read_message_id, original.id);
assertEquals(reads.auto_read_message_id, original.id);
assertEquals(
  (await row("conversations", conversation.id)).last_message_id,
  original.id,
);
const { count, error: attachmentError } = await db.from("message_attachments")
  .select("*", { count: "exact", head: true }).eq("message_id", original.id);
if (attachmentError) throw attachmentError;
assertEquals(count, 2);
const { data: inbox, error: inboxError } = await db.from("imessage_events")
  .select("*").eq("event_key", eventId).single();
if (inboxError) throw inboxError;
assert(inbox.processed_at);
assertEquals(inbox.processing_error, null);
assertEquals(
  (await send({ ...event(guid, tempGuid), EventId: eventId })).body.duplicate,
  true,
);
console.log(
  "PASS compatible split consolidation, references, attachments, monotonic state and inbox replay",
);

const raceGuid = crypto.randomUUID();
const raceTemp = crypto.randomUUID();
const race = await Promise.all(
  Array.from({ length: 6 }, (_, i) =>
    send({
      ...event(raceGuid, raceTemp),
      EventId: crypto.randomUUID(),
      EventType: i % 2 ? "new-message" : "reconciliation-message",
    })),
);
assertEquals(race.map((x) => x.status), [200, 200, 200, 200, 200, 200]);
const { data: raceRows, error: raceError } = await db.from("messages")
  .select("*").eq("imessage_guid", raceGuid);
if (raceError) throw raceError;
assertEquals(raceRows?.length, 1);
assertEquals(raceRows![0].is_historical_import, false);
console.log("PASS concurrent first arrivals and live/reconciliation replay");

const conflictTemp = crypto.randomUUID();
const conflictGuid = crypto.randomUUID();
const contradictory = await insert("messages", {
  ...base,
  imessage_guid: crypto.randomUUID(),
  imessage_temp_guid: conflictTemp,
});
const conflictEvent = crypto.randomUUID();
assertEquals(
  (await send({ ...event(conflictGuid, conflictTemp), EventId: conflictEvent }))
    .status,
  500,
);
assertEquals(
  (await row("messages", contradictory.id)).imessage_guid,
  contradictory.imessage_guid,
);
const { data: failed, error: failedError } = await db.from("imessage_events")
  .select("*").eq("event_key", conflictEvent).single();
if (failedError) throw failedError;
assertEquals(failed.processed_at, null);
assert(failed.processing_error);
console.log(
  "PASS conflicting provider identity stays unresolved without mutation",
);

const inboundGuid = crypto.randomUUID();
const incoming = {
  EventType: "new-message",
  MessageGuid: inboundGuid,
  IsFromMe: false,
  From: contact.phone_e164,
  To: owned.phone_e164,
  Date: date,
  Body: "Synthetic inbound",
};
assertEquals(
  (await send({ ...incoming, EventId: crypto.randomUUID() })).status,
  200,
);
const { data: inboundRows, error: inboundError } = await db.from("messages")
  .select("*").eq("imessage_guid", inboundGuid);
if (inboundError) throw inboundError;
assertEquals(inboundRows?.length, 1);
assertEquals(inboundRows![0].direction, "INBOUND");
const { count: readCount, error: readCountError } = await db.from(
  "conversation_reads",
)
  .select("*", { head: true, count: "exact" }).eq(
    "conversation_id",
    conversation.id,
  );
if (readCountError) throw readCountError;
assertEquals(readCount, 0);
console.log("PASS live inbound unread state");

const rollbackGuid = crypto.randomUUID();
const rollbackTemp = crypto.randomUUID();
const rollbackProvider = await insert("messages", {
  ...base,
  imessage_guid: rollbackGuid,
});
const rollbackOriginal = await insert("messages", {
  ...base,
  imessage_temp_guid: rollbackTemp,
});
const rollbackAttachment = await insert("message_attachments", {
  message_id: rollbackProvider.id,
  storage_url: "https://synthetic.invalid/rollback.png",
});
const { error: rollbackError } = await db.rpc("reconcile_imessage_inbound", {
  p_message: {
    ...base,
    imessage_guid: rollbackGuid,
    imessage_temp_guid: rollbackTemp,
    is_reaction: false,
  },
  p_attachments: [{ storage_url: null }],
  p_from_live: true,
  p_historical: false,
});
assertEquals(rollbackError?.code, "23502");
assertEquals(
  (await row("messages", rollbackProvider.id)).imessage_guid,
  rollbackGuid,
);
assertEquals((await row("messages", rollbackOriginal.id)).imessage_guid, null);
assertEquals(
  (await row("message_attachments", rollbackAttachment.id)).message_id,
  rollbackProvider.id,
);
console.log("PASS downstream failure rolls back consolidation and references");
const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
  auth: { persistSession: false },
});
const { error: denied } = await anon.rpc("reconcile_imessage_inbound", {
  p_message: {},
  p_attachments: [],
  p_from_live: true,
  p_historical: false,
});
assertEquals(denied?.code, "42501");
console.log("PASS untrusted callers cannot reconcile identities");
