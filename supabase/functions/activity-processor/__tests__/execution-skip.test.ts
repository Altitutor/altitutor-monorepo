import { assertEquals, assertRejects } from "jsr:@std/assert";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { processExecution } from "../execution.ts";

function fixture() {
  const execution = {
    id: "execution",
    rule_id: "rule",
    domain_event_id: "event",
    status: "PENDING",
    attempt_count: 0,
  };
  const state = {
    execution,
    contacts: [] as Array<Record<string, unknown>>,
    contactReads: 0,
    lookupError: false,
    skipError: false,
    laterFails: true,
    laterCalls: 0,
    sends: 0,
    skips: [] as Array<Record<string, unknown>>,
    notices: [] as Array<Record<string, unknown>>,
  };
  const actions = [
    {
      id: "message-action",
      action_type: "SEND_MESSAGE",
      action_config: {
        message_content: "Synthetic notice",
        recipients: { type: "student_and_parents" },
      },
    },
    {
      id: "later-action",
      action_type: "CREATE_NOTIFICATION",
      action_config: {
        notification_type: "SYNTHETIC",
        title: "Later action",
        staff_id: "admin",
        app_scope: "staff_web",
      },
    },
  ];
  const client = {
    functions: {
      invoke: () => {
        state.sends++;
        throw new Error("Unexpected send");
      },
    },
    rpc(name: string, args: Record<string, unknown>) {
      if (name === "claim_automation_execution") {
        if (execution.status === "COMPLETED") {
          return Promise.resolve({ data: [], error: null });
        }
        execution.attempt_count++;
        return Promise.resolve({ data: [{ ...execution }], error: null });
      }
      if (name === "record_automation_message_skip") {
        if (state.skipError) {
          return Promise.resolve({
            data: null,
            error: new Error("Skip persistence unavailable"),
          });
        }
        if (!state.skips.length) {
          state.skips.push({
            execution_id: args.p_execution_id,
            action_id: args.p_action_id,
          });
          state.notices.push({
            notification_type: "AUTOMATION_MESSAGE_SKIPPED",
          });
        }
        return Promise.resolve({ data: null, error: null });
      }
      throw new Error(`Unexpected RPC ${name}`);
    },
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      let single = false;
      let patch: Record<string, unknown> | undefined;
      let notifications: Array<Record<string, unknown>> | undefined;
      const query = {
        select: () => query,
        order: () => query,
        is: () => query,
        limit: () => query,
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return query;
        },
        in: () => query,
        maybeSingle: () => {
          single = true;
          return query;
        },
        update: (value: Record<string, unknown>) => {
          patch = value;
          return query;
        },
        upsert: (value: Array<Record<string, unknown>>) => {
          notifications = value;
          return query;
        },
        then(
          resolve: (value: { data: unknown; error: Error | null }) => unknown,
        ) {
          let data: unknown = null;
          let error: Error | null = null;
          if (table === "automation_executions") {
            if (patch) Object.assign(execution, patch);
            data = execution;
          } else if (table === "automation_rules") {
            data = {
              id: "rule",
              name: "Synthetic rule",
              enabled: true,
              conditions: {},
            };
          } else if (table === "domain_events") {
            data = {
              id: "event",
              event_name: "session.student_added",
              subject_type: "session",
              subject_id: "session",
              payload: {},
            };
          } else if (table === "domain_event_entities") {
            data = [{
              entity_type: "session",
              entity_id: "session",
              role: "subject",
            }, {
              entity_type: "student",
              entity_id: "student",
              role: "related",
            }];
          } else if (table === "automation_actions") data = actions;
          else if (table === "automation_message_action_skips") {
            data = single ? state.skips[0] ?? null : state.skips;
          } else if (table === "contacts") {
            state.contactReads++;
            const rows = state.contacts.filter((row) =>
              filters.every(([column, value]) => row[column] === value)
            );
            data = single ? rows[0] ?? null : rows;
            if (state.lookupError) {
              error = new Error("Contact lookup unavailable");
            }
          } else if (
            table === "parents_students" || table === "classes_students"
          ) data = [];
          else if (table === "notifications") {
            state.laterCalls++;
            if (state.laterFails) error = new Error("Later action unavailable");
            else {
              state.notices.push(...notifications ?? []);
              data = [{ id: "notification" }];
            }
          } else if (table !== "students" && table !== "sessions") {
            throw new Error(`Unexpected table ${table}`);
          }
          return Promise.resolve({ data, error }).then(resolve);
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
  return { state, client, actions };
}

Deno.test("a terminal empty-recipient action survives whole-execution retry after contacts appear", async () => {
  const { state, client } = fixture();
  await assertRejects(
    () => processExecution(client, "execution"),
    Error,
    "Later action unavailable",
  );
  assertEquals(state.execution.status, "FAILED");
  assertEquals(
    state.skips.length,
    1,
    "The original zero-target action needs a durable outcome",
  );
  assertEquals(
    state.laterCalls,
    1,
    "The empty action must not stop the next action",
  );
  const reads = state.contactReads;
  state.contacts = [{
    id: "new-contact",
    student_id: "student",
    contact_type: "STUDENT",
    is_opted_out: false,
  }];
  state.laterFails = false;
  assertEquals(await processExecution(client, "execution"), {
    executionId: "execution",
    status: "COMPLETED",
  });
  assertEquals(
    state.contactReads,
    reads,
    "A terminal skip must be checked before resolving new contacts",
  );
  assertEquals(state.sends, 0);
  assertEquals(state.skips.length, 1);
  assertEquals(
    state.notices.length,
    2,
    "One durable skip notice and the later successful action",
  );
  assertEquals(await processExecution(client, "execution"), {
    executionId: "execution",
    status: "COMPLETED",
  });
  assertEquals(
    state.laterCalls,
    2,
    "Completed executions must not replay actions",
  );
});

Deno.test("lookup failures never become terminal zero-recipient outcomes", async () => {
  const { state, client } = fixture();
  state.lookupError = true;
  await assertRejects(
    () => processExecution(client, "execution"),
    Error,
    "Contact lookup unavailable",
  );
  assertEquals(state.skips.length, 0);
  assertEquals(state.laterCalls, 0);
});
Deno.test("a skip persistence failure stays retryable without running later actions", async () => {
  const { state, client } = fixture();
  state.skipError = true;
  await assertRejects(
    () => processExecution(client, "execution"),
    Error,
    "Skip persistence unavailable",
  );
  assertEquals(state.skips.length, 0);
  assertEquals(state.laterCalls, 0);
  assertEquals(state.execution.status, "FAILED");
});
Deno.test("an opted-out single recipient is skipped and never invoked", async () => {
  const { state, client, actions } = fixture();
  state.laterFails = false;
  actions[0].action_config = {
    message_content: "Synthetic notice",
    recipients: { type: "single" },
    student_id: "student",
  } as typeof actions[0]["action_config"];
  state.contacts = [{
    id: "contact",
    student_id: "student",
    contact_type: "STUDENT",
    is_opted_out: true,
  }];
  assertEquals(await processExecution(client, "execution"), {
    executionId: "execution",
    status: "COMPLETED",
  });
  assertEquals(state.skips.length, 1);
  assertEquals(state.sends, 0);
});
