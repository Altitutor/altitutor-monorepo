import { NextRequest, NextResponse } from "next/server";
import { emailAccess } from "@/features/email/server/auth";
import { emailListSchema } from "@/features/email/types";
import { mailboxConfigured } from "@/features/email/server/connection";
import { listScheduledMail } from "@/features/email/server/scheduled-list";
export async function GET(request: NextRequest) {
  const access = await emailAccess();
  if ("error" in access)
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  const params = request.nextUrl.searchParams;
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const [folders, threads, staff, states, templates, signature] =
    await Promise.all([
      access.db
        .from("email_folders")
        .select("id,name,parent_id,role")
        .eq("present", true)
        .order("name"),
      params.get("folder") === "@scheduled"
        ? listScheduledMail(access.admin, {
            search: (params.get("search") ?? "").slice(0, 300),
            assignees: (params.get("assignee") ?? "all")
              .split(",")
              .map((value) => (value === "mine" ? access.staff.id : value)),
            offset,
            sort: params.get("sort") ?? "received",
            direction: params.get("direction") ?? "desc",
          })
            .then((data) => ({ data, error: null }))
            .catch(() => ({
              data: null,
              error: { message: "Could not load scheduled emails." },
            }))
        : access.db.rpc("email_list_threads", {
            p_folder_id: params.get("folder") ?? "",
            p_search: (params.get("search") ?? "").slice(0, 300),
            p_assignee: (params.get("assignee") ?? "all")
              .split(",")
              .map((value) => (value === "mine" ? access.staff.id : value))
              .join(","),
            p_offset: offset,
            p_limit: 50,
            p_sort: params.get("sort") ?? "received",
            p_direction: params.get("direction") ?? "desc",
          }),
      access.db
        .from("staff")
        .select("id,first_name,last_name")
        .eq("role", "ADMINSTAFF")
        .eq("status", "ACTIVE")
        .order("first_name"),
      access.admin
        .from("email_sync_state")
        .select("folder_id,page_at,completed_at,last_error"),
      access.db.from("email_templates").select("*").order("name"),
      access.db
        .from("email_signatures")
        .select("body_text")
        .eq("staff_id", access.staff.id)
        .maybeSingle(),
    ]);
  if (
    [folders, threads, staff, states, templates, signature].some(
      (result) => result.error,
    )
  )
    return NextResponse.json(
      { error: "Could not load the mailbox." },
      { status: 503 },
    );
  return NextResponse.json(
    {
      folders: folders.data,
      ...emailListSchema.parse(threads.data),
      staff: staff.data,
      currentStaffId: access.staff.id,
      sync: states.data,
      configured: mailboxConfigured(),
      mailboxAddress: access.mailbox.address,
      mailboxEnvironment: access.mailbox.environment,
      templates: templates.data,
      signature:
        signature.data?.body_text ??
        `${[access.staff.first_name, access.staff.last_name].filter(Boolean).join(" ")}\nAltitutor`,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
