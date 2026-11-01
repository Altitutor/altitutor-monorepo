/** @jest-environment node */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { mailboxCommands } from "../commands";
import { createGraphMailbox } from "../graph";
jest.mock("server-only", () => ({}));
it("returns the current Microsoft draft for a conflict already detected by synchronization without writing or sending", async () => {
  const requests: Array<{ url: string; method: string }> = [];
  const current = {
    id: "conflict-draft",
    threadId: "conflict-thread",
    folderId: "drafts",
    draft: true,
    changeKey: "two",
    bodyText: "Outlook work",
    subject: "Reply",
    sender: "admin@altitutor.com",
    to: ["parent@example.test"],
    cc: [],
    bcc: [],
  };
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    requests.push({ url, method });
    if (url.includes("/rpc/email_claim_draft"))
      return Response.json({ state: "conflict" });
    if (url.includes("/rpc/email_apply_sync_page")) return Response.json(true);
    if (url.startsWith("https://graph.microsoft.com/") && method === "GET")
      return Response.json({
        id: current.id,
        conversationId: current.threadId,
        parentFolderId: "drafts",
        isDraft: true,
        changeKey: "two",
        subject: "Reply",
        body: { contentType: "Text", content: "Outlook work" },
        from: { emailAddress: { address: current.sender } },
        toRecipients: [{ emailAddress: { address: current.to[0] } }],
      });
    if (url.includes("/email_messages"))
      return Response.json({
        id: current.id,
        data: current,
        thread_id: current.threadId,
        folder_id: "drafts",
        removed: false,
      });
    throw new Error(`Unexpected external boundary: ${method} ${url}`);
  };
  const db = createClient<Database>(
    "http://127.0.0.1:1",
    "fixture-service-key",
    {
      global: { fetch: fetchImpl },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const command = mailboxCommands(
    db,
    {
      id: "fa250000-0000-4000-8000-000000000001",
      first_name: "Admin",
      last_name: "User",
    },
    createGraphMailbox({
      mailbox: {
        environment: "production",
        address: "admin@altitutor.com",
        allowedRecipients: [],
      },
      accessToken: "fixture-token",
      fetchImpl,
    }),
  );
  await expect(
    command({
      action: "save",
      id: current.id,
      editToken: "fa250000-0000-4000-8000-000000000002",
      content: {
        expectedChangeKey: "one",
        bodyText: "Portal work",
        subject: "Reply",
        to: ["parent@example.test"],
        cc: [],
        bcc: [],
      },
    }),
  ).resolves.toMatchObject({
    state: "conflict",
    message: { bodyText: "Outlook work", changeKey: "two" },
  });
  expect(
    requests.filter(
      (request) =>
        request.url.startsWith("https://graph.microsoft.com/") &&
        request.method !== "GET",
    ),
  ).toEqual([]);
});

it("rejects an Outlook-added development Bcc recipient before claiming or submitting a send", async () => {
  const requests: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    if (url.startsWith("https://graph.microsoft.com/"))
      return Response.json({
        id: "dev-draft",
        conversationId: "dev-thread",
        parentFolderId: "drafts",
        isDraft: true,
        changeKey: "one",
        subject: "Test",
        body: { contentType: "Text", content: "Test" },
        from: { emailAddress: { address: "admin@development.altitutor.com" } },
        toRecipients: [{ emailAddress: { address: "matt@altitutor.com" } }],
        bccRecipients: [{ emailAddress: { address: "outside@example.test" } }],
      });
    throw new Error("A blocked send must not reach the database");
  };
  const db = createClient<Database>(
    "http://127.0.0.1:1",
    "fixture-service-key",
    {
      global: { fetch: fetchImpl },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const command = mailboxCommands(
    db,
    { id: "staff", first_name: "Admin", last_name: null },
    createGraphMailbox({
      mailbox: {
        environment: "development",
        address: "admin@development.altitutor.com",
        allowedRecipients: ["matt@altitutor.com"],
      },
      accessToken: "fixture-token",
      fetchImpl,
    }),
  );
  await expect(
    command({
      action: "send",
      id: "dev-draft",
      changeKey: "one",
      commandId: "fa250000-0000-4000-8000-000000000003",
    }),
  ).rejects.toThrow("configured test recipients");
  expect(requests).toHaveLength(1);
});
