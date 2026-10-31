/** @jest-environment node */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { listScheduledMail } from "../scheduled-list";
it("finds and groups matching scheduled drafts beyond the first database batch before paginating", async () => {
  type Row = Record<string, unknown>;
  const drafts = Array.from({ length: 28 }, (_, i) => ({
    id: `draft-${i}`,
    thread_id: i >= 26 ? "matching-thread" : `thread-${i}`,
    removed: false,
    data: {
      id: `draft-${i}`,
      threadId: i >= 26 ? "matching-thread" : `thread-${i}`,
      subject: i >= 26 ? "Class change" : "Other email",
      bodyText: "Draft body",
      sender: "admin@example.test",
      to: ["parent@example.test"],
      draft: true,
      read: true,
    },
  }));
  const tables: Record<string, Row[]> = {
    email_send_attempts: drafts.map((item, i) => ({
      message_id: item.id,
      scheduled_at: `2026-11-${String(i + 1).padStart(2, "0")}T09:00:00Z`,
      state: "scheduled",
    })),
    email_messages: drafts,
    email_threads: [...new Set(drafts.map((item) => item.thread_id))].map(
      (id) => ({
        id,
        assigned_staff_id: id === "matching-thread" ? "admin" : null,
      }),
    ),
  };
  const db = {
    from: (table: string) => {
      let rows = tables[table] ?? [];
      const query = {
        select: () => query,
        in: (key: string, values: unknown[]) => {
          rows = rows.filter((item) => values.includes(item[key]));
          return query;
        },
        eq: (key: string, value: unknown) => {
          rows = rows.filter((item) => item[key] === value);
          return query;
        },
        order: () => query,
        range: (start: number, end: number) => {
          rows = rows.slice(start, end + 1);
          return query;
        },
        then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
          Promise.resolve(resolve({ data: rows, error: null })),
      };
      return query;
    },
  } as unknown as SupabaseClient<Database>;
  const result = await listScheduledMail(db, {
    search: "class change",
    assignees: ["admin"],
    offset: 0,
    sort: "received",
    direction: "asc",
  });
  expect(result.threads).toHaveLength(1);
  expect(result.threads[0]).toMatchObject({
    id: "matching-thread",
    messageIds: ["draft-26", "draft-27"],
    assignedStaffId: "admin",
    draft: true,
  });
  expect(result.hasMore).toBe(false);
});
