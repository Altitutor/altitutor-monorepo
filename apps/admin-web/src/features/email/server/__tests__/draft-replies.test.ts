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
