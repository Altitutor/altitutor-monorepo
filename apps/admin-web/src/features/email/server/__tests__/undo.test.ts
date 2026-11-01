/** @jest-environment node */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { mailboxCommands } from "../commands";
import { createGraphMailbox } from "../graph";
jest.mock("server-only", () => ({}));
const commandId = "fa250000-0000-4000-8000-000000000099";
function fixture() {
  const messages = new Map([
    [
      "one",
      { id: "one", isRead: true, parentFolderId: "inbox", changeKey: "v1" },
    ],
    [
      "two",
      { id: "two", isRead: false, parentFolderId: "sent", changeKey: "v1" },
    ],
  ]);
  const receipts: Array<{ id: string; payload: unknown }> = [];
  const writes: string[] = [];
  const schedules: unknown[] = [];
  let serial = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input)),
      method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url.hostname === "graph.microsoft.com") {
      const segments = url.pathname.split("/");
      const id = decodeURIComponent(segments[5] ?? "");
      const message = messages.get(id);
      if (!message) throw new Error("Unknown fixture message");
      if (method !== "GET") {
        writes.push(`${method}:${id}`);
        if (method === "PATCH") message.isRead = body.isRead;
        else if (segments.at(-1) === "move")
          message.parentFolderId = body.destinationId;
        message.changeKey = `v${++serial + 1}`;
      }
      return Response.json({
        ...message,
        conversationId: "thread",
        isDraft: true,
        toRecipients: [{ emailAddress: { address: "matt@altitutor.com" } }],
      });
    }
    if (url.pathname.endsWith("/rpc/email_schedule_send")) {
      schedules.push(body);
      return Response.json({ state: "scheduled" });
    }
    if (url.pathname.endsWith("/rpc/email_apply_sync_page"))
      return Response.json(true);
    if (url.pathname.endsWith("/email_command_undos")) {
      if (method === "POST") {
        const receipt = { ...body, id: commandId };
        receipts.push(receipt);
        return Response.json(receipt);
      }
      if (method === "DELETE")
        return Response.json(receipts.splice(0, 1)[0] ?? null);
    }
    if (url.pathname.endsWith("/email_messages")) {
      const id = url.searchParams.get("id")?.replace(/^eq\./, "") ?? "one";
      const m = messages.get(id)!;
      return Response.json({
        id,
        thread_id: "thread",
        folder_id: m.parentFolderId,
        removed: false,
        data: { id, threadId: "thread", changeKey: m.changeKey },
      });
    }
    throw new Error(`Unexpected boundary: ${method} ${url.pathname}`);
  };
  const db = createClient<Database>("http://127.0.0.1:1", "fixture-key", {
    global: { fetch: fetchImpl },
    auth: { persistSession: false },
  });
  const command = mailboxCommands(
    db,
    { id: commandId, first_name: "Admin", last_name: null },
    createGraphMailbox({
      mailbox: {
        address: "admin@development.altitutor.com",
        environment: "development",
        allowedRecipients: ["matt@altitutor.com"],
      },
      accessToken: "fixture-token",
      fetchImpl,
    }),
  );
  return { command, messages, writes, schedules };
}
it("restores each moved message to its own original folder", async () => {
  const { command, messages } = fixture();
  const result = await command({
    action: "move",
    ids: ["one", "two"],
    folderId: "archive",
  });
  expect(messages.get("one")!.parentFolderId).toBe("archive");
  expect(result).toMatchObject({ undoIds: [commandId] });
  await command({ action: "undo", ids: [commandId] });
  expect(messages.get("one")!.parentFolderId).toBe("inbox");
  expect(messages.get("two")!.parentFolderId).toBe("sent");
});
it("restores mixed read states and refuses to overwrite a newer Outlook change", async () => {
  const first = fixture();
  await first.command({ action: "read", ids: ["one", "two"], read: true });
  await first.command({ action: "undo", ids: [commandId] });
  expect(first.messages.get("one")!.isRead).toBe(true);
  expect(first.messages.get("two")!.isRead).toBe(false);
  const newer = fixture();
  await newer.command({ action: "move", ids: ["one"], folderId: "archive" });
  newer.messages.get("one")!.changeKey = "outlook-newer";
  await expect(
    newer.command({ action: "undo", ids: [commandId] }),
  ).rejects.toThrow("changed");
  expect(newer.messages.get("one")!.parentFolderId).toBe("archive");
});
it("holds Undo Send durably for ten seconds without calling Microsoft send", async () => {
  const { command, writes, schedules } = fixture();
  const before = Date.now();
  await expect(
    command({
      action: "send",
      id: "one",
      changeKey: "v1",
      commandId,
      undoDelaySeconds: 10,
    }),
  ).resolves.toMatchObject({ state: "queued", commandId });
  expect(writes).toEqual([]);
  expect(schedules).toHaveLength(1);
  const at = (schedules[0] as { p_scheduled_at: string }).p_scheduled_at;
  expect(new Date(at).getTime()).toBeGreaterThanOrEqual(before + 10_000);
});
