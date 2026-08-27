import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { parseIMessageEvent } from "../_shared/imessage.ts";
import { updateMessageFromDeliveryEvent } from "./delivery.ts";

type QueryCall =
  | { method: "from"; table: string }
  | { method: "update"; values: Record<string, unknown> }
  | { method: "eq"; column: string; value: unknown }
  | { method: "in"; column: string; values: unknown[] }
  | { method: "is"; column: string; value: unknown }
  | { method: "execute" };

function supabaseRecorder(): {
  supabase: SupabaseClient;
  calls: QueryCall[];
} {
  const calls: QueryCall[] = [];
  const query: Record<string, unknown> & PromiseLike<{ error: null }> = {
    update(values: Record<string, unknown>) {
      calls.push({ method: "update", values });
      return query;
    },
    eq(column: string, value: unknown) {
      calls.push({ method: "eq", column, value });
      return query;
    },
    in(column: string, values: unknown[]) {
      calls.push({ method: "in", column, values });
      return query;
    },
    is(column: string, value: unknown) {
      calls.push({ method: "is", column, value });
      return query;
    },
    then<TResult1 = { error: null }, TResult2 = never>(
      onfulfilled?:
        | ((value: { error: null }) => TResult1 | PromiseLike<TResult1>)
        | null,
      _onrejected?:
        | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
        | null,
    ): PromiseLike<TResult1 | TResult2> {
      calls.push({ method: "execute" });
      return Promise.resolve({ error: null }).then(onfulfilled);
    },
  };
  const supabase = {
    from(table: string) {
      calls.push({ method: "from", table });
      return query;
    },
  } as unknown as SupabaseClient;
  return { supabase, calls };
}

describe("iMessage delivery correlation", () => {
  it("updates an existing message from a GUID-only delivered event", async () => {
    const { supabase, calls } = supabaseRecorder();
    const event = parseIMessageEvent({
      EventType: "updated-message",
      MessageGuid: "provider-guid",
      DeliveryState: "delivered",
      Date: "2026-07-17T07:45:00.000Z",
      DateDelivered: "2026-07-17T07:45:03.000Z",
      Service: "iMessage",
    });

    await updateMessageFromDeliveryEvent(
      supabase,
      event,
      () => "2026-07-17T07:46:00.000Z",
    );

    expect(calls).toEqual([
      { method: "from", table: "messages" },
      {
        method: "update",
        values: {
          status: "DELIVERED",
          status_updated_at: "2026-07-17T07:45:03.000Z",
          delivered_at: "2026-07-17T07:45:03.000Z",
        },
      },
      { method: "eq", column: "imessage_guid", value: "provider-guid" },
      {
        method: "in",
        column: "status",
        values: [
          "QUEUED",
          "SENDING",
          "FAILED",
          "AMBIGUOUS",
          "SENT",
          "DELIVERED",
        ],
      },
      { method: "execute" },
      { method: "from", table: "messages" },
      { method: "update", values: { apple_service: "iMessage" } },
      { method: "eq", column: "imessage_guid", value: "provider-guid" },
      { method: "is", column: "apple_service", value: null },
      { method: "execute" },
    ]);
  });

  it("handles an unmatched GUID without creating message identity", async () => {
    const { supabase, calls } = supabaseRecorder();
    const event = parseIMessageEvent({
      EventType: "updated-message",
      MessageGuid: "unknown-guid",
      DeliveryState: "delivered",
    });

    await updateMessageFromDeliveryEvent(supabase, event);

    expect(
      calls.some((call) => call.method === "from" && call.table !== "messages"),
    )
      .toBe(false);
  });
});
