/** @jest-environment node */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { createGraphMailbox } from "../graph";
import { resolveDraftReplyTargets } from "../draft-replies";
import type { EmailMessage } from "../../types";
jest.mock("server-only", () => ({}));
it("resolves an older Outlook draft from explicit reply headers and caches the checked provider version", async () => {
  const draft: EmailMessage = {
    id: "outlook-draft",
    threadId: "one",
    folderId: "drafts",
    draft: true,
    removed: false,
    subject: "Re: Lesson",
    bodyText: "Existing work",
    sender: "admin@altitutor.com",
    to: ["parent@example.test"],
    cc: [],
    bcc: [],
    changeKey: "v1",
  };
  let cached = draft;
  const graphReads: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.host === "graph.microsoft.com") {
      graphReads.push(url.searchParams.get("$select") ?? "");
      return Response.json({
        id: draft.id,
        conversationId: "one",
        parentFolderId: "drafts",
        isDraft: true,
        changeKey: "v1",
        subject: draft.subject,
        from: { emailAddress: { address: draft.sender } },
        body: { contentType: "text", content: "Existing work" },
        toRecipients: [{ emailAddress: { address: "parent@example.test" } }],
        internetMessageHeaders: [
          { name: "In-Reply-To", value: "<original@example.test>" },
          {
            name: "Subject",
            value: "A subject must never identify a reply target",
          },
        ],
      });
    }
    if (url.pathname.endsWith("/rpc/email_cache_draft_reply_targets")) {
      const value = JSON.parse(String(init?.body));
      cached = {
        ...cached,
        replyToInternetMessageIds: value.p_targets,
        replyTargetVersion: value.p_change_key,
      };
      return Response.json(true);
    }
    if (url.pathname.endsWith("/rpc/email_apply_sync_page")) {
      cached = { ...cached, ...JSON.parse(String(init?.body)).p_messages[0] };
      return Response.json(true);
    }
    if (url.pathname.endsWith("/email_messages"))
      return Response.json({
        id: cached.id,
        thread_id: cached.threadId,
        folder_id: cached.folderId,
        removed: false,
        data: cached,
      });
    throw Error("Unexpected boundary");
  };
  const db = createClient<Database>("http://127.0.0.1:1", "fixture-key", {
    global: { fetch: fetchImpl },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const mailbox = createGraphMailbox({
    mailbox: {
      environment: "production",
      address: "admin@altitutor.com",
      allowedRecipients: [],
    },
    accessToken: "fixture-token",
    fetchImpl,
  });
  const resolved = await resolveDraftReplyTargets(
    db,
    [draft],
    async () => mailbox,
    "admin@altitutor.com",
  );
  expect(resolved[0]).toMatchObject({
    replyToInternetMessageIds: ["<original@example.test>"],
    replyTargetVersion: "v1",
    bodyText: "Existing work",
  });
  await resolveDraftReplyTargets(
    db,
    resolved,
    async () => mailbox,
    "admin@altitutor.com",
  );
  expect(graphReads).toHaveLength(1);
  expect(graphReads[0]).toContain("internetMessageHeaders");
});
it("tries a failed mailbox connection only once for a thread with multiple unknown drafts", async () => {
  const drafts: EmailMessage[] = Array.from({ length: 5 }, (_, i) => ({
    id: "native-" + i,
    threadId: "one",
    draft: true,
    removed: false,
    subject: "Reply",
    bodyText: "Work",
    sender: "admin@altitutor.com",
    to: [],
    cc: [],
    bcc: [],
    changeKey: "one",
  }));
  const connect = jest.fn(async () => {
    throw Error("Provider unavailable");
  });
  const db = createClient<Database>("http://127.0.0.1:1", "fixture-key", {
    auth: { persistSession: false },
  });
  expect(
    await resolveDraftReplyTargets(db, drafts, connect, "admin@altitutor.com"),
  ).toEqual(drafts);
  expect(connect).toHaveBeenCalledTimes(1);
});
it("does not let a delayed header read overwrite a newer delta snapshot", async () => {
  const draft: EmailMessage = {
    id: "racing-draft",
    threadId: "one",
    folderId: "drafts",
    draft: true,
    removed: false,
    subject: "Reply",
    bodyText: "Old work",
    sender: "admin@altitutor.com",
    to: [],
    cc: [],
    bcc: [],
    changeKey: "v1",
  };
  let cached = draft;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.host === "graph.microsoft.com") {
      cached = { ...draft, changeKey: "v3", bodyText: "Newer Outlook work" };
      return Response.json({
        id: draft.id,
        conversationId: "one",
        parentFolderId: "drafts",
        isDraft: true,
        changeKey: "v1",
        body: { contentType: "text", content: "Old work" },
        internetMessageHeaders: [
          { name: "In-Reply-To", value: "<original@example.test>" },
        ],
      });
    }
    if (url.pathname.endsWith("/rpc/email_apply_sync_page")) {
      cached = { ...cached, ...JSON.parse(String(init?.body)).p_messages[0] };
      return Response.json(true);
    }
    if (url.pathname.endsWith("/rpc/email_cache_draft_reply_targets"))
      return Response.json(false);
    if (url.pathname.endsWith("/email_messages"))
      return Response.json({
        id: cached.id,
        thread_id: cached.threadId,
        folder_id: cached.folderId,
        removed: false,
        data: cached,
      });
    throw Error("Unexpected boundary");
  };
  const db = createClient<Database>("http://127.0.0.1:1", "fixture-key", {
    global: { fetch: fetchImpl },
    auth: { persistSession: false },
  });
  const mailbox = createGraphMailbox({
    mailbox: {
      environment: "production",
      address: "admin@altitutor.com",
      allowedRecipients: [],
    },
    accessToken: "fixture-token",
    fetchImpl,
  });
  await resolveDraftReplyTargets(
    db,
    [draft],
    async () => mailbox,
    "admin@altitutor.com",
  );
  expect(cached).toMatchObject({
    changeKey: "v3",
    bodyText: "Newer Outlook work",
  });
});
it("returns cached drafts within a bounded deadline when authentication never completes", async () => {
  const drafts: EmailMessage[] = [
    {
      id: "native-timeout",
      threadId: "one",
      draft: true,
      removed: false,
      subject: "Reply",
      bodyText: "Keep work",
      sender: "admin@altitutor.com",
      to: [],
      cc: [],
      bcc: [],
      changeKey: "one",
    },
  ];
  const connect = jest.fn(
    () => new Promise<ReturnType<typeof createGraphMailbox>>(() => {}),
  );
  const db = createClient<Database>("http://127.0.0.1:1", "fixture-key", {
    auth: { persistSession: false },
  });
  const started = Date.now();
  expect(
    await resolveDraftReplyTargets(db, drafts, connect, "admin@altitutor.com"),
  ).toEqual(drafts);
  expect(Date.now() - started).toBeLessThan(4000);
  expect(connect).toHaveBeenCalledTimes(1);
});
