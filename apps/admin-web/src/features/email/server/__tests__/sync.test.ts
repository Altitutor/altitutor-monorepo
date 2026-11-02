/** @jest-environment node */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { syncMailbox } from "../sync";
import { createGraphMailbox } from "../graph";
jest.mock("server-only", () => ({}));
it("resets an expired development cursor through the existing RPC and releases the sync lease", async () => {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const address = "admin@development.altitutor.com";
  const cursor = `https://graph.microsoft.com/v1.0/users/${address}/mailFolders/inbox/messages/delta?$deltatoken=expired`;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const path = decodeURIComponent(url.pathname);
    if (path.includes("/rpc/")) {
      const name = path.split("/").at(-1)!;
      const args = JSON.parse(String(init?.body));
      rpcCalls.push({ name, args });
      if (name === "email_claim_scheduled_sends") return Response.json([]);
      if (name === "email_assert_mailbox") return Response.json(address);
      if (
        name === "email_reset_sync_cursor" &&
        Object.keys(args).sort().join(",") !== "p_expected_cursor,p_folder_id"
      )
        return Response.json(
          { message: "Unknown RPC signature" },
          { status: 404 },
        );
      return Response.json(true);
    }
    if (url.hostname === "127.0.0.1") {
      if (path.endsWith("/email_operational_sends")) return Response.json([]);
      if (path.endsWith("/email_sync_state"))
        return Response.json([{ folder_id: "inbox", cursor_url: cursor }]);
      if (path.endsWith("/email_folders"))
        return Response.json(
          init?.method === "POST" ? null : [{ id: "inbox" }],
        );
    }
    if (path.endsWith("/messages/delta"))
      return Response.json(
        { error: { code: "SyncStateNotFound" } },
        { status: 410 },
      );
    if (path.endsWith("/mailFolders"))
      return Response.json({
        value: [{ id: "inbox", displayName: "Inbox", childFolderCount: 0 }],
      });
    if (path.endsWith("/mailFolders/inbox"))
      return Response.json({ id: "inbox", displayName: "Inbox" });
    if (path.includes("/mailFolders/"))
      return Response.json({}, { status: 404 });
    throw new Error(`Unexpected boundary: ${path}`);
  };
  const db = createClient<Database>("http://127.0.0.1:1", "fixture-key", {
    global: { fetch: fetchImpl },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const mailbox = createGraphMailbox({
    mailbox: {
      environment: "development",
      address,
      allowedRecipients: ["matt@altitutor.com"],
    },
    accessToken: "fixture-token",
    fetchImpl,
  });
  await expect(syncMailbox(db, mailbox)).resolves.toMatchObject({ errors: 1 });
  expect(rpcCalls).toContainEqual({
    name: "email_reset_sync_cursor",
    args: { p_folder_id: "inbox", p_expected_cursor: cursor },
  });
  expect(rpcCalls.at(-1)?.name).toBe("email_release_sync");
});

it("keeps Outlook delta progress on every pass while scheduled work remains due", async () => {
  const address = "admin@development.altitutor.com";
  let claimed = 0,
    sent = 0,
    deltas = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input)),
      path = decodeURIComponent(url.pathname),
      method = init?.method ?? "GET";
    if (path.endsWith("/rpc/email_assert_mailbox"))
      return Response.json(address);
    if (path.endsWith("/rpc/email_claim_scheduled_sends"))
      return Response.json([
        {
          message_id: `due-${++claimed}`,
          command_id: `command-${claimed}`,
          staff_id: "staff",
          change_key: "one",
        },
      ]);
    if (path.includes("/rpc/")) return Response.json(true);
    if (
      path.endsWith("/email_operational_sends") ||
      path.endsWith("/email_sync_state")
    )
      return Response.json([]);
    if (path.endsWith("/email_folders"))
      return Response.json(method === "POST" ? null : [{ id: "inbox" }]);
    if (path.endsWith("/staff")) return Response.json({ id: "staff" });
    if (path.endsWith("/email_messages")) {
      const id = url.searchParams.get("id")?.slice(3) ?? "due";
      return Response.json({
        id,
        thread_id: "scheduled-thread",
        folder_id: "drafts",
        data: { draft: true, changeKey: "one" },
        removed: false,
      });
    }
    if (path.endsWith("/email_send_attempts"))
      return new Response(null, { status: 204 });
    if (path.endsWith("/messages/delta")) {
      deltas++;
      return Response.json({
        value: [],
        "@odata.deltaLink": `https://graph.microsoft.com/v1.0/users/${address}/mailFolders/inbox/messages/delta?$deltatoken=next`,
      });
    }
    if (path.endsWith("/mailFolders"))
      return Response.json({
        value: [{ id: "inbox", displayName: "Inbox", childFolderCount: 0 }],
      });
    if (path.endsWith("/mailFolders/inbox"))
      return Response.json({ id: "inbox", displayName: "Inbox" });
    if (path.includes("/mailFolders/"))
      return new Response(null, { status: 404 });
    if (path.endsWith("/send")) {
      sent++;
      return new Response(null, { status: 202 });
    }
    if (path.includes("/messages/due-"))
      return Response.json({
        id: path.split("/").at(-1),
        conversationId: "scheduled-thread",
        isDraft: true,
        changeKey: "one",
        toRecipients: [{ emailAddress: { address: "matt@altitutor.com" } }],
      });
    throw new Error(`Unexpected boundary: ${path}`);
  };
  const db = createClient<Database>("http://127.0.0.1:1", "fixture-key", {
    global: { fetch: fetchImpl },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const mailbox = createGraphMailbox({
    mailbox: {
      environment: "development",
      address,
      allowedRecipients: ["matt@altitutor.com"],
    },
    accessToken: "fixture-token",
    fetchImpl,
  });
  await expect(syncMailbox(db, mailbox)).resolves.toMatchObject({
    pages: 1,
    scheduled: 1,
  });
  await expect(syncMailbox(db, mailbox)).resolves.toMatchObject({
    pages: 1,
    scheduled: 1,
  });
  expect(deltas).toBe(2);
  expect(sent).toBe(2);
});
