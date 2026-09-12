import type { Json } from "@altitutor/shared";
import { z } from "zod";

const id = z.string().uuid();
const date = z.string().datetime({ offset: true }).nullable();
const richText: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(richText),
    z.record(richText),
  ]),
);
const text = z.string().trim().min(1).max(500);
export const operationSchemas = {
  issue: z
    .object({
      name: text,
      description: richText.optional(),
      status: z.enum(["open", "awaiting_response", "resolved"]).optional(),
      due_date: date.optional(),
    })
    .strict(),
  task: z
    .object({
      title: text,
      description: richText.optional(),
      status: z
        .enum(["backlog", "todo", "in_progress", "in_review", "done"])
        .optional(),
      priority: z.number().int().min(0).max(4).optional(),
      assigned_to: id.nullable().optional(),
      issue_id: id.nullable().optional(),
      project_id: id.nullable().optional(),
      estimate: z.number().int().min(1).max(5).nullable().optional(),
      due_date: date.optional(),
    })
    .strict(),
  project: z
    .object({
      name: text,
      description: richText.optional(),
      status: z
        .enum(["backlog", "planned", "in_progress", "completed"])
        .optional(),
      priority: z.number().int().min(0).max(4).optional(),
      project_lead_id: id.nullable().optional(),
      member_ids: z.array(id).max(200).optional(),
      start_date: date.optional(),
      target_date: date.optional(),
    })
    .strict(),
  document: z
    .object({
      title: text,
      content: richText.optional(),
      folder_id: id.nullable().optional(),
      project_id: id.nullable().optional(),
      is_tutor_documentation: z.boolean().optional(),
    })
    .strict(),
  note: z
    .object({
      note: richText,
      target_type: z.enum([
        "student",
        "staff",
        "parent",
        "class",
        "session",
        "invoice",
        "subject",
        "task",
        "issue",
        "project",
        "document",
      ]),
      target_id: id,
    })
    .strict(),
  folder: z
    .object({ name: text, parent_id: id.nullable().optional() })
    .strict(),
  daily_note: z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      content: richText.optional(),
    })
    .strict(),
  template: z.object({ name: text, content: richText }).strict(),
};
export type WorkItemKind = keyof typeof operationSchemas;
export const workItemTables: Record<WorkItemKind, string> = {
  issue: "issues",
  task: "tasks",
  project: "projects",
  document: "notes_documents",
  note: "notes",
  folder: "notes_folders",
  daily_note: "notes_daily",
  template: "rich_text_templates",
};

export function changeSchema(kind: WorkItemKind) {
  if (kind === "note")
    return operationSchemas.note.pick({ note: true }).partial();
  if (kind === "daily_note")
    return operationSchemas.daily_note.pick({ content: true }).partial();
  return operationSchemas[kind].partial();
}
