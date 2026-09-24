import type { Json, Database } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export type UcatNotificationPriority = "normal" | "important" | "critical";

type CreateUcatNotificationInput = {
  studentId: string;
  type: string;
  title: string;
  body?: string | null;
  actionUrl?: string | null;
  metadata?: Json;
  dedupeKey?: string | null;
  priority?: UcatNotificationPriority;
  expiresAt?: string | null;
  createdByStaffId?: string | null;
};

export async function createUcatNotification(
  supabase: SupabaseClient<Database>,
  input: CreateUcatNotificationInput,
): Promise<boolean> {
  const row = {
    student_id: input.studentId,
    notification_type: input.type,
    app_scope: "ucat_web",
    title: input.title,
    body: input.body ?? null,
    action_url: input.actionUrl ?? null,
    metadata: input.metadata ?? {},
    dedupe_key: input.dedupeKey ?? null,
    priority: input.priority ?? "normal",
    expires_at: input.expiresAt ?? null,
    created_by_staff_id: input.createdByStaffId ?? null,
  };

  const result = input.dedupeKey
    ? await supabase
        .from("notifications")
        .upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true })
    : await supabase.from("notifications").insert(row);

  if (result.error) {
    console.warn("[ucat notifications] Failed to create notification", {
      type: input.type,
      studentId: input.studentId,
      error: result.error,
    });
    return false;
  }

  return true;
}
