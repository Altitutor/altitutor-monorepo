import "server-only";
import { BUSINESS_TIMEZONE } from "@altitutor/shared";
import { PRIORITY_OPTIONS } from "@/shared/constants/entity-properties";
import type { Database } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailMessageSchema } from "@/features/email/types";
import type { ReferenceDetails } from "../types";

async function read<T>(
  query: PromiseLike<{ data: T; error: { message: string } | null }>,
): Promise<T> {
  const result = await query;
  if (result.error) throw new Error("Reference data unavailable");
  return result.data;
}
const person = (
  row: { first_name: string | null; last_name: string | null } | null,
) => (row ? [row.first_name, row.last_name].filter(Boolean).join(" ") : "");
const list = (values: (string | null | undefined)[]) =>
  values.filter(Boolean).join(", ") || "None";
const date = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("en-AU") : "Not set";
const priority = (value: number) =>
  PRIORITY_OPTIONS.find((option) => option.value === value)?.label ??
  "No priority";
const field = (label: string, value: string | number | null | undefined) => ({
  label,
  value: String(value ?? "Not set"),
});

/** Small, explicitly selected display projections; never return complete business rows to a hover card. */
export async function referenceDetails(
  db: SupabaseClient<Database>,
  type: string,
  id: string,
): Promise<ReferenceDetails | null> {
  switch (type) {
    case "student": {
      const row = await read(
        db
          .from("students")
          .select("first_name,last_name,status,year_level")
          .eq("id", id)
          .maybeSingle(),
      );
      if (!row) return null;
      const links = await read(
        db
          .from("classes_students")
          .select("classes(short_name)")
          .eq("student_id", id)
          .is("unenrolled_at", null),
      );
      return {
        title: person(row),
        status: row.status,
        fields: [
          field("Year level", row.year_level),
          field(
            "Classes",
            list((links ?? []).map((link) => link.classes?.short_name)),
          ),
        ],
      };
    }
    case "parent": {
      const row = await read(
        db
          .from("parents")
          .select("first_name,last_name")
          .eq("id", id)
          .maybeSingle(),
      );
      if (!row) return null;
      const links = await read(
        db
          .from("parents_students")
          .select("students(first_name,last_name)")
          .eq("parent_id", id),
      );
      return {
        title: person(row),
        fields: [
          field(
            "Students",
            list((links ?? []).map((link) => person(link.students))),
          ),
        ],
      };
    }
    case "staff": {
      const row = await read(
        db
          .from("staff")
          .select("first_name,last_name,status,role")
          .eq("id", id)
          .maybeSingle(),
      );
      if (!row) return null;
      const links = await read(
        db
          .from("classes_staff")
          .select("classes(short_name)")
          .eq("staff_id", id)
          .is("unassigned_at", null),
      );
      return {
        title: person(row),
        status: row.status,
        fields: [
          field("Role", row.role),
          field(
            "Classes",
            list((links ?? []).map((link) => link.classes?.short_name)),
          ),
        ],
      };
    }
    case "class": {
      const row = await read(
        db
          .from("classes")
          .select(
            "short_name,long_name,status,schedule_summary_long,subjects(name,short_name)",
          )
          .eq("id", id)
          .maybeSingle(),
      );
      if (!row) return null;
      const [students, staff] = await Promise.all([
        read(
          db
            .from("classes_students")
            .select("students(first_name,last_name)")
            .eq("class_id", id)
            .is("unenrolled_at", null),
        ),
        read(
          db
            .from("classes_staff")
            .select(
              "staff!class_assignments_staff_id_fkey(first_name,last_name)",
            )
            .eq("class_id", id)
            .is("unassigned_at", null),
        ),
      ]);
      return {
        title: row.long_name || row.short_name || "Class",
        status: row.status,
        fields: [
          field("Subject", row.subjects?.short_name || row.subjects?.name),
          field("Scheduled offerings", row.schedule_summary_long),
          field(
            "Students",
            list((students ?? []).map((link) => person(link.students))),
          ),
          field("Staff", list((staff ?? []).map((link) => person(link.staff)))),
        ],
      };
    }
    case "session": {
      const row = await read(
        db
          .from("sessions")
          .select(
            "short_name,long_name,status,start_at,end_at,subjects(name,short_name)",
          )
          .eq("id", id)
          .maybeSingle(),
      );
      if (!row) return null;
      const [students, staff] = await Promise.all([
        read(
          db
            .from("sessions_students")
            .select("students(first_name,last_name)")
            .eq("session_id", id),
        ),
        read(
          db
            .from("sessions_staff")
            .select("staff!sessions_staff_staff_id_fkey(first_name,last_name)")
            .eq("session_id", id),
        ),
      ]);
      const time = (value: string | null) =>
        value
          ? new Date(value).toLocaleTimeString("en-AU", {
              hour: "numeric",
              minute: "2-digit",
              timeZone: BUSINESS_TIMEZONE,
            })
          : "Not set";
      return {
        title: row.long_name || row.short_name || "Session",
        status: row.status,
        fields: [
          field("Subject", row.subjects?.short_name || row.subjects?.name),
          field(
            "Day",
            row.start_at
              ? new Date(row.start_at).toLocaleDateString("en-AU", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                  timeZone: BUSINESS_TIMEZONE,
                })
              : null,
          ),
          field("Time", `${time(row.start_at)} – ${time(row.end_at)}`),
          field(
            "Students",
            list((students ?? []).map((link) => person(link.students))),
          ),
          field("Staff", list((staff ?? []).map((link) => person(link.staff)))),
        ],
      };
    }
    case "task": {
      const row = await read(
        db
          .from("tasks")
          .select(
            "title,status,priority,due_date,staff!tasks_assigned_to_fkey(first_name,last_name),projects(name),issues(name)",
          )
          .eq("id", id)
          .maybeSingle(),
      );
      if (!row) return null;
      return {
        title: row.title,
        status: row.status,
        fields: [
          field("Priority", priority(row.priority ?? 0)),
          field("Assignee", person(row.staff) || "Unassigned"),
          field("Due date", date(row.due_date)),
          ...(row.projects ? [field("Project", row.projects.name)] : []),
          ...(row.issues ? [field("Issue", row.issues.name)] : []),
        ],
      };
    }
    case "issue": {
      const row = await read(
        db
          .from("issues")
          .select("name,status,priority,due_date")
          .eq("id", id)
          .maybeSingle(),
      );
      if (!row) return null;
      return {
        title: row.name,
        status: row.status,
        fields: [
          field("Priority", priority(row.priority)),
          field("Due date", date(row.due_date)),
        ],
      };
    }
    case "project": {
      const row = await read(
        db
          .from("projects")
          .select("name,status,priority,start_date,target_date")
          .eq("id", id)
          .maybeSingle(),
      );
      if (!row) return null;
      const members = await read(
        db
          .from("project_members")
          .select("staff!project_members_staff_id_fkey(first_name,last_name)")
          .eq("project_id", id),
      );
      return {
        title: row.name,
        status: row.status,
        fields: [
          field("Priority", priority(row.priority ?? 0)),
          field("Start date", date(row.start_date)),
          field("Target date", date(row.target_date)),
          field(
            "Members",
            list((members ?? []).map((link) => person(link.staff))),
          ),
        ],
      };
    }
    case "message": {
      const row = await read(
        db
          .from("messages")
          .select("body,status,from_number_e164,to_number_e164,conversation_id")
          .eq("id", id)
          .maybeSingle(),
      );
      if (!row) return null;
      return {
        title: row.body.slice(0, 80) || "Message",
        status: row.status,
        fields: [
          field("From", row.from_number_e164),
          field("To", row.to_number_e164),
          field("Message", row.body.slice(0, 500)),
        ],
        destination: {
          kind: "messages",
          id: row.conversation_id,
          title: "Messages",
          query: `conversation=${encodeURIComponent(row.conversation_id)}&message=${encodeURIComponent(id)}`,
        },
      };
    }
    case "email": {
      const row = await read(
        db
          .from("email_messages")
          .select("thread_id,data")
          .eq("id", id)
          .maybeSingle(),
      );
      if (!row) {
        // Existing email references identify a thread, rather than an individual message.
        const thread = await read(
          db.from("email_threads").select("id").eq("id", id).maybeSingle(),
        );
        return thread
          ? {
              title: "Email conversation",
              fields: [],
              destination: { kind: "email", id, title: "Email", query: "" },
            }
          : null;
      }
      const email = emailMessageSchema.parse(row.data);
      return {
        title: email.subject || "No subject",
        fields: [
          field(
            "From",
            email.senderName
              ? `${email.senderName} <${email.sender}>`
              : email.sender,
          ),
          field("To", list(email.to)),
          field("Subject", email.subject || "No subject"),
          field("Email", email.bodyText.slice(0, 500)),
        ],
        destination: {
          kind: "email",
          id: row.thread_id,
          title: email.subject || "Email",
          query: `message=${encodeURIComponent(id)}`,
        },
      };
    }
    case "note":
    case "document": {
      const row = await read(
        db.from("notes_documents").select("title").eq("id", id).maybeSingle(),
      );
      return row
        ? { title: row.title || "Untitled document", fields: [] }
        : null;
    }
    case "subject": {
      const row = await read(
        db
          .from("subjects")
          .select("name,long_name,short_name,curriculum")
          .eq("id", id)
          .maybeSingle(),
      );
      return row
        ? {
            title: row.long_name || row.short_name || row.name,
            fields: [field("Curriculum", row.curriculum)],
          }
        : null;
    }
    case "topic": {
      const row = await read(
        db.from("topics").select("name,code").eq("id", id).maybeSingle(),
      );
      return row
        ? { title: `${row.code} ${row.name}`.trim(), fields: [] }
        : null;
    }
    case "adminShift":
    case "admin-shift": {
      const row = await read(
        db
          .from("admin_shifts")
          .select("status,start_time,end_time")
          .eq("id", id)
          .maybeSingle(),
      );
      return row
        ? {
            title: "Admin shift",
            status: row.status,
            fields: [field("Time", `${row.start_time} – ${row.end_time}`)],
          }
        : null;
    }
    case "tutorLog":
    case "tutor-log": {
      const row = await read(
        db
          .from("tutor_logs")
          .select("session_id,session_type")
          .eq("id", id)
          .maybeSingle(),
      );
      return row
        ? {
            title: "Tutor log",
            fields: [field("Session type", row.session_type)],
            href: `/sessions/${encodeURIComponent(row.session_id)}`,
          }
        : null;
    }
    case "file": {
      const row = await read(
        db
          .from("topics_files")
          .select("code,files(filename),topics(name)")
          .eq("id", id)
          .maybeSingle(),
      );
      return row
        ? {
            title: row.files?.filename || row.code || "File",
            fields: [field("Topic", row.topics?.name)],
          }
        : null;
    }
    case "invoice": {
      const row = await read(
        db
          .from("invoices")
          .select("stripe_invoice_number,status")
          .eq("id", id)
          .maybeSingle(),
      );
      return row
        ? {
            title: row.stripe_invoice_number || "Invoice",
            status: row.status,
            fields: [],
          }
        : null;
    }
    default:
      return null;
  }
}
