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
