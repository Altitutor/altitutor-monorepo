import "server-only";
import { ensureMailboxIdentity } from "./identity";
import { getMailboxPolicy } from "./config";
import { randomUUID } from "node:crypto";
import type { Database, Json } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchScheduledMail } from "./scheduled";
import { reconcileOperationalMail } from "./reconcile-operational";
import { connectMailbox } from "./connection";
import { GraphMailboxError, type createGraphMailbox } from "./graph";

/** One bounded pass shared by cron and foreground clients; every page commits atomically. */
export async function syncMailbox(
  db: SupabaseClient<Database>,
  connector?: ReturnType<typeof createGraphMailbox>,
) {
  const started = Date.now();
  await ensureMailboxIdentity(db, connector?.policy ?? getMailboxPolicy());
  const token = randomUUID();
  const claimed = await db.rpc("email_claim_sync", { p_token: token });
  if (claimed.error) throw claimed.error;
  if (!claimed.data)
    return { pages: 0, imported: 0, folders: 0, more: true, busy: true };
  try {
    const mailbox = connector ?? (await connectMailbox());
    // One due send and the normal two-request delta workers can make progress
    // together (at most three background Graph requests). A send backlog must
    // not starve Outlook reconciliation or reserve jobs we cannot start.
    const [scheduled, synced] = await Promise.allSettled([
      dispatchScheduledMail(db, mailbox),
      synchronize(db, mailbox, started, token),
    ]);
    if (scheduled.status === "rejected") throw scheduled.reason;
    if (synced.status === "rejected") throw synced.reason;
    return { ...synced.value, scheduled: scheduled.value };
  } finally {
    const released = await db.rpc("email_release_sync", { p_token: token });
    if (released.error) throw released.error;
  }
}

async function refreshFolderInventory(
  db: SupabaseClient<Database>,
  mailbox: ReturnType<typeof createGraphMailbox>,
  token: string,
) {
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
  // A complete provider scan is authoritative for folder removals.
  const saved = await db.rpc("email_reconcile_sync_folder_inventory", {
    p_mailbox_address: mailbox.policy.address,
    p_token: token,
    p_folders: folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      parent_id: folder.parentId,
      role: roles.find((known) => known?.id === folder.id)?.role ?? null,
    })),
  });
  if (saved.error) throw saved.error;
  return folders.map(({ id }) => id);
}

async function synchronize(
  db: SupabaseClient<Database>,
  mailbox: ReturnType<typeof createGraphMailbox>,
  started: number,
  token: string,
) {
  await reconcileOperationalMail(db, mailbox);
  const inventory = await db.rpc("email_read_sync_folder_inventory", {
    p_mailbox_address: mailbox.policy.address,
    p_token: token,
  });
  if (inventory.error) throw inventory.error;
  const folderIds =
    inventory.data ?? (await refreshFolderInventory(db, mailbox, token));
  const states = await db.from("email_sync_state").select("*");
  if (states.error) throw states.error;
  const statesByFolder = new Map(
    states.data.map((state) => [state.folder_id, state]),
  );
  const queue = folderIds.map((id) => {
    const state = statesByFolder.get(id);
    return {
      id,
      cursor: state?.cursor_url ?? undefined,
      pageAt: state?.page_at ?? "",
    };
  });
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
    folders: folderIds.length,
    more: queue.length > 0 || errors > 0,
    errors,
  };
}
