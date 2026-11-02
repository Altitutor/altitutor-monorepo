/** @jest-environment node */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { createGraphMailbox } from "../graph";
import { dispatchScheduledMail } from "../scheduled";
jest.mock("server-only", () => ({}));
it.each(["unchanged", "outlook-edit", "blocked-recipient", "uncertain"])(
  "dispatches a scheduled draft safely for %s",
  async (scenario) => {
    let claims = 0,
      submissions = 0;
    const outcomes: string[] = [];
    const draft = {
      id: "scheduled-draft",
      threadId: "scheduled-thread",
      draft: true,
      changeKey: scenario === "outlook-edit" ? "two" : "one",
      to: [
        scenario === "blocked-recipient"
          ? "outside@example.test"
          : "matt@altitutor.com",
      ],
    };
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input),
        method = init?.method ?? "GET";
      if (url.includes("/rpc/email_claim_scheduled_sends"))
        return Response.json(
          claims++
            ? []
            : [
                {
                  message_id: draft.id,
                  command_id: "command",
                  staff_id: "staff",
                  change_key: "one",
                },
              ],
        );
      if (url.includes("/staff")) return Response.json({ id: "staff" });
      if (url.includes("/rpc/email_apply_sync_page"))
        return Response.json(true);
      if (url.includes("/email_messages"))
        return Response.json({
          id: draft.id,
          thread_id: draft.threadId,
          data: draft,
          removed: false,
          folder_id: "drafts",
        });
      if (url.includes("/email_send_attempts") && method === "PATCH") {
        outcomes.push(JSON.parse(String(init?.body)).state);
        return new Response(null, { status: 204 });
      }
      if (url.startsWith("https://graph.microsoft.com/") && method === "GET")
        return Response.json({
          id: draft.id,
          conversationId: draft.threadId,
          isDraft: true,
          changeKey: draft.changeKey,
          toRecipients: draft.to.map((address) => ({
            emailAddress: { address },
          })),
        });
      if (url.endsWith("/send")) {
        submissions++;
        if (scenario === "uncertain") throw new Error("Connection interrupted");
        return new Response(null, { status: 202 });
      }
      throw new Error(`Unexpected boundary: ${method} ${url}`);
    };
    const db = createClient<Database>("http://127.0.0.1:1", "fixture-service", {
      global: { fetch: fetchImpl },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const mailbox = createGraphMailbox({
      mailbox: {
        environment: "development",
        address: "admin@development.altitutor.com",
        allowedRecipients: ["matt@altitutor.com"],
      },
      accessToken: "fixture-token",
      fetchImpl,
    });
    await dispatchScheduledMail(db, mailbox);
    await dispatchScheduledMail(db, mailbox);
    expect(submissions).toBe(
      ["unchanged", "uncertain"].includes(scenario) ? 1 : 0,
    );
    expect(outcomes).toEqual([
      scenario === "unchanged"
        ? "submitted"
        : scenario === "uncertain"
          ? "uncertain"
          : "paused",
    ]);
  },
);
