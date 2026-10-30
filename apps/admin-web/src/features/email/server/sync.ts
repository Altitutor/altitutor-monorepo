import "server-only";
import { ensureMailboxIdentity } from "./identity";
import { getMailboxPolicy } from "./config";
import { randomUUID } from "node:crypto";
import type { Database, Json } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reconcileOperationalMail } from "./reconcile-operational";
import { connectMailbox } from "./connection";
import { GraphMailboxError, type createGraphMailbox } from "./graph";

/** One bounded pass shared by cron and foreground clients; every page commits atomically. */
export async function syncMailbox(
  db: SupabaseClient<Database>,
  connector?: ReturnType<typeof createGraphMailbox>,
) {
  await ensureMailboxIdentity(db, connector?.policy ?? getMailboxPolicy());
  const token = randomUUID();
  const claimed = await db.rpc("email_claim_sync", { p_token: token });
  if (claimed.error) throw claimed.error;
  if (!claimed.data)
    return { pages: 0, imported: 0, folders: 0, more: true, busy: true };
  try {
    return await synchronize(db, connector);
  } finally {
    const released = await db.rpc("email_release_sync", { p_token: token });
    if (released.error) throw released.error;
  }
}

async function synchronize(
  db: SupabaseClient<Database>,
  connector?: ReturnType<typeof createGraphMailbox>,
) {
  const started = Date.now();
  const mailbox = connector ?? (await connectMailbox());
  await reconcileOperationalMail(db, mailbox);
  const folders = await mailbox.folders();
  // Outlook allows four concurrent requests per app/mailbox. Use two sync
  // requests at a time, leaving capacity for foreground commands.
  const roles: Array<{ role: string; id: string } | null> = [];
  const names = [
    "inbox",
    "sentitems",
    "drafts",
    "archive",
    "deleteditems",
    "junkemail",
  ];
  for (let offset = 0; offset < names.length; offset += 2) {
    roles.push(
      ...(await Promise.all(
        names.slice(offset, offset + 2).map(async (role) => {
          try {
            return { role, ...(await mailbox.folder(role)) };
          } catch (error) {
            if (error instanceof GraphMailboxError && error.status === 404)
              return null;
            throw error;
          }
        }),
      )),
    );
  }
  if (folders.length) {
    const saved = await db.from("email_folders").upsert(
      folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        parent_id: folder.parentId,
        role: roles.find((known) => known?.id === folder.id)?.role ?? null,
        present: true,
      })),
    );
    if (saved.error) throw saved.error;
  }
  // Only a complete provider enumeration can remove a folder from navigation.
  const known = await db.from("email_folders").select("id").eq("present", true);
  if (known.error) throw known.error;
  const missing = known.data.filter(
    (folder) => !folders.some((current) => current.id === folder.id),
  );
  if (missing.length) {
    const marked = await db
      .from("email_folders")
      .update({ present: false })
      .in(
        "id",
        missing.map((folder) => folder.id),
      );
    if (marked.error) throw marked.error;
    const cleared = await db
      .from("email_messages")
      .update({ removed: true, folder_id: null })
      .in(
        "folder_id",
        missing.map((folder) => folder.id),
      );
    if (cleared.error) throw cleared.error;
  }
  const states = await db.from("email_sync_state").select("*");
  if (states.error) throw states.error;
  const queue = folders.map((folder) => ({
    id: folder.id,
    cursor:
      states.data.find((state) => state.folder_id === folder.id)?.cursor_url ??
      undefined,
    pageAt:
      states.data.find((state) => state.folder_id === folder.id)?.page_at ?? "",
  }));
  queue.sort((a, b) => a.pageAt.localeCompare(b.pageAt));
  let pages = 0,
    imported = 0,
    errors = 0;
  async function worker() {
    while (queue.length && pages < 100 && Date.now() - started < 40_000) {
      const folder = queue.shift()!;
      pages++;
      try {
        const page = await mailbox.changes(folder.id, folder.cursor);
        const saved = await db.rpc("email_apply_sync_page", {
          p_mailbox_address: mailbox.policy.address,
          p_folder_id: folder.id,
          p_expected_cursor: folder.cursor ?? "",
          p_cursor: page.cursor,
          p_complete: page.complete,
          p_messages: JSON.parse(JSON.stringify(page.messages)) as Json,
          p_removed_ids: page.removedIds,
        });
        if (saved.error) throw saved.error;
        if (saved.data) {
          imported += page.messages.length;
          if (!page.complete) queue.push({ ...folder, cursor: page.cursor });
        }
      } catch (error) {
        errors++;
        if (error instanceof GraphMailboxError && error.status === 410) {
          const reset = await db.rpc("email_reset_sync_cursor", {
            p_mailbox_address: mailbox.policy.address,
            p_folder_id: folder.id,
            p_expected_cursor: folder.cursor ?? "",
          });
          if (reset.error) throw reset.error;
        } else {
          const marked = await db.from("email_sync_state").upsert({
            folder_id: folder.id,
            last_error:
              error instanceof GraphMailboxError
                ? error.message
                : "Mailbox sync failed; retry to resume this folder.",
          });
          if (marked.error) throw marked.error;
        }
        // Other folders still progress; the error remains visible until this
        // folder successfully resumes on the next bounded pass.
      }
    }
  }
  const workers = await Promise.allSettled([worker(), worker()]);
  for (const result of workers)
    if (result.status === "rejected") throw result.reason;
  return {
    pages,
    imported,
    folders: folders.length,
    more: queue.length > 0 || errors > 0,
    errors,
  };
}
