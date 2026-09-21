import type { JSONContent } from "@altitutor/ui";
import type { Json } from "@altitutor/shared";
import type { TaskFormData } from "@/features/tasks/types";
import type { IssueFormData } from "@/features/issues/types";
import type { ProjectFormData } from "@/features/projects/types";
import type { NoteFormData } from "@/features/notes/types";
import type { EditRecord } from "./api";
const date = (value: Json | undefined) =>
  typeof value === "string" ? value.split("T")[0] : null;
const text = (value: Json | undefined) =>
  typeof value === "string" ? value : "";
const optionalText = (value: Json | undefined) =>
  typeof value === "string" ? value : null;
const json = (value: unknown) => value as Json;
export const taskFromRecord = (r: EditRecord): TaskFormData => ({
  title: text(r.title),
  description: (r.description as JSONContent) ?? null,
  status: (r.status ?? "backlog") as TaskFormData["status"],
  priority: Number(r.priority ?? 0),
  assignedTo: optionalText(r.assigned_to),
  issueId: optionalText(r.issue_id),
  projectId: optionalText(r.project_id),
  estimate: r.estimate == null ? null : Number(r.estimate),
  dueDate: date(r.due_date),
});
export const taskToRecord = (v: TaskFormData): EditRecord => ({
  title: v.title,
  description: json(v.description),
  status: v.status,
  priority: v.priority,
  assigned_to: v.assignedTo,
  issue_id: v.issueId,
  project_id: v.projectId,
  estimate: v.estimate || null,
  due_date: v.dueDate ? new Date(v.dueDate).toISOString() : null,
});
export const issueFromRecord = (r: EditRecord): IssueFormData => ({
  name: text(r.name),
  description: (r.description as JSONContent) ?? null,
  status: (r.status ?? "open") as IssueFormData["status"],
  dueDate: date(r.due_date),
});
export const issueToRecord = (v: IssueFormData): EditRecord => ({
  name: v.name,
  description: json(v.description),
  status: v.status,
  due_date: v.dueDate ? new Date(v.dueDate).toISOString() : null,
});
export const projectFromRecord = (r: EditRecord): ProjectFormData => ({
  name: text(r.name),
  description: (r.description as JSONContent) ?? null,
  status: (r.status ?? "backlog") as ProjectFormData["status"],
  priority: Number(r.priority ?? 0) as ProjectFormData["priority"],
  projectLeadId: optionalText(r.project_lead_id),
  memberIds: (r.member_ids ?? []) as string[],
  startDate: date(r.start_date),
  targetDate: date(r.target_date),
});
export const projectToRecord = (v: ProjectFormData): EditRecord => ({
  name: v.name,
  description: json(v.description),
  status: v.status,
  priority: v.priority,
  project_lead_id: v.projectLeadId,
  member_ids: v.memberIds,
  start_date: v.startDate ? new Date(v.startDate).toISOString() : null,
  target_date: v.targetDate ? new Date(v.targetDate).toISOString() : null,
});
export const documentFromRecord = (r: EditRecord): NoteFormData => ({
  title: text(r.title),
  content: (r.content as JSONContent) ?? "",
  folder_id: optionalText(r.folder_id),
  project_id: optionalText(r.project_id),
  is_tutor_documentation: !!r.is_tutor_documentation,
});
export const documentToRecord = (v: NoteFormData): EditRecord => ({
  title: v.title,
  content: json(v.content),
  folder_id: v.folder_id,
  project_id: v.project_id,
  is_tutor_documentation: v.is_tutor_documentation,
});
