import { BUSINESS_TIMEZONE } from "@altitutor/shared";
import type { ActivityEventDisplay } from "../types";

export const activityTypes = [
  { value: "note", label: "Notes" },
  { value: "session", label: "Sessions" },
  { value: "billing", label: "Billing" },
  { value: "student", label: "Students" },
  { value: "parent", label: "Parents" },
  { value: "staff", label: "Staff" },
  { value: "class", label: "Classes" },
  { value: "work", label: "Tasks, projects and issues" },
  { value: "form", label: "Forms" },
  { value: "other", label: "Other activity" },
];

export const communicationTypes = [
  { value: "message:student", label: "Student messages" },
  { value: "message:parent", label: "Parent messages" },
  { value: "message:staff", label: "Staff messages" },
  { value: "message:group", label: "Group messages" },
  { value: "email:student", label: "Student emails" },
  { value: "email:parent", label: "Parent emails" },
  { value: "email:staff", label: "Staff emails" },
];

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type ActivityFilters = Record<string, unknown[]>;

export function activityCategory(eventName: string) {
  const [entity, action] = eventName.split(".");
  if (
    entity === "invoice" ||
    action?.includes("credit") ||
    action?.startsWith("payment_") ||
    action?.startsWith("subsidy_")
  )
    return "billing";
  if (["task", "issue", "project"].includes(entity)) return "work";
  if (entity === "admin_shift") return "session";
  return activityTypes.some(({ value }) => value === entity) ? entity : "other";
}

export function matchesActivityFilters(
  filters: ActivityFilters,
  search: string,
  category: string,
  at: string,
  text: string,
) {
  if (filters.type?.length && !filters.type.includes(category)) return false;
  const from = filters.from?.[0];
  const to = filters.to?.[0];
  if (typeof from === "string" || typeof to === "string") {
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) return false;
    const localDate = dateFormatter.format(date);
    if (typeof from === "string" && localDate < from) return false;
    if (typeof to === "string" && localDate > to) return false;
  }
  return text.toLowerCase().includes(search.trim().toLowerCase());
}

function noteText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  if ("text" in value && typeof value.text === "string") return value.text;
  return "content" in value && Array.isArray(value.content)
    ? value.content.map(noteText).join(" ")
    : "";
}

export function matchesActivityItem(
  activity: ActivityEventDisplay,
  filters: ActivityFilters,
  search: string,
) {
  return matchesActivityFilters(
    filters,
    search,
    activityCategory(activity.eventType ?? ""),
    activity.performedAt,
    search.trim()
      ? [
          activity.message,
          activity.performedBy.name,
          noteText(activity.noteContent),
        ].join(" ")
      : "",
  );
}
