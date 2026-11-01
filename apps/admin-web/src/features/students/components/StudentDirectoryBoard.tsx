"use client";
import { Badge, ScrollArea } from "@altitutor/ui";
import { stages } from "@/features/onboarding/lib/model";
import { ActionBadges } from "@/features/onboarding/components/JourneyDetail";
import { InPersonStatusBadge } from "./InPersonStatusBadge";
import type { StudentDirectoryEntry } from "../types/directory";

export const studentGroupOptions = [
  { key: "stage", label: "Onboarding status" },
  { key: "status", label: "In-person status" },
  { key: "curriculum", label: "Curriculum" },
  { key: "year_level", label: "Year level" },
  { key: "account_class", label: "Account class" },
];
export function studentGroup(
  entry: StudentDirectoryEntry,
  group: string | null,
) {
  if (group === "stage") return entry.stage ?? "No onboarding";
  if (group === "status") return entry.student?.status ?? "No in-person status";
  if (group === "curriculum")
    return entry.student?.curriculum ?? "No curriculum";
  if (group === "year_level")
    return entry.student?.year_level
      ? `Year ${entry.student.year_level}`
      : "No year level";
  if (group === "account_class")
    return entry.student?.account_class ?? "Enquiries";
  return "Students";
}
export function StudentDirectoryBoard({
  entries,
  groupBy,
  columns,
  open,
}: {
  entries: StudentDirectoryEntry[];
  groupBy: string | null;
  columns: string[];
  open: (entry: StudentDirectoryEntry) => void;
}) {
  const groups = [
    ...new Set([
      ...(groupBy === "stage" ? [...stages, "No onboarding"] : []),
      ...entries.map((entry) => studentGroup(entry, groupBy)),
    ]),
  ];
  return (
    <div
      role="region"
      aria-label="Board"
      className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden"
    >
      {entries.length === 0 && (
        <p className="px-6 py-4 text-sm text-muted-foreground">
          No students match your filters
        </p>
      )}
      <div className="flex h-full min-w-max gap-4 px-4 pt-2">
        {groups.map((group) => {
          const rows = entries.filter(
            (entry) => studentGroup(entry, groupBy) === group,
          );
          return (
            <section
              key={group}
              aria-label={group}
              className="flex h-full min-h-0 w-[300px] shrink-0 flex-col overflow-hidden rounded-lg bg-muted/30"
            >
              <div className="flex items-center gap-2 p-3">
                <h2 className="text-sm font-semibold">{group}</h2>
                <Badge variant="outline">{rows.length}</Badge>
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-2 p-2 pt-0">
                  {rows.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => open(entry)}
                      className="flex w-full flex-col gap-2 rounded-lg border bg-card p-3 text-left hover:bg-accent/50"
                    >
                      <h3 className="line-clamp-2 break-words text-sm font-medium">
                        {entry.label}
                      </h3>
                      {columns.includes("status") && (
                        <InPersonStatusBadge
                          status={entry.student?.status ?? null}
                          className="w-fit text-xs"
                        />
                      )}
                      {columns.includes("education") && (
                        <span className="text-xs">
                          {[
                            entry.student?.curriculum,
                            entry.student?.year_level &&
                              `Year ${entry.student.year_level}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                      {columns.includes("products") && (
                        <span className="text-xs">
                          {entry.products
                            .map(
                              (product) =>
                                `${product.product === "UCAT_WEB" ? "UCAT Web" : "Student Web"} · ${product.tier === "UNLIMITED" ? "Unlimited" : "Free"}`,
                            )
                            .join(", ") || "No online products"}
                        </span>
                      )}
                      {columns.includes("online_since") && (
                        <span className="text-xs text-muted-foreground">
                          {entry.online_since
                            ? new Date(entry.online_since).toLocaleDateString()
                            : "No online relationship"}
                        </span>
                      )}
                      {columns.includes("onboarding_status") && (
                        <>
                          <span className="text-xs">
                            {entry.stage ?? "No onboarding"}
                          </span>
                          {entry.journey && (
                            <ActionBadges actions={entry.actions} />
                          )}
                        </>
                      )}
                      {columns.includes("subjects") && (
                        <span className="text-xs text-muted-foreground">
                          {entry.journey?.evidence.subjects
                            .map((subject) => subject.name)
                            .join(" · ") ||
                            entry.student?.subjects
                              ?.map(
                                (subject) => subject.long_name || subject.name,
                              )
                              .join(" · ")}
                        </span>
                      )}
                      {columns.includes("email") && (
                        <span className="break-all text-xs">
                          {entry.student?.email}
                        </span>
                      )}
                      {columns.includes("phone") && (
                        <span className="text-xs">{entry.student?.phone}</span>
                      )}
                      {columns.includes("school") && (
                        <span className="text-xs">{entry.student?.school}</span>
                      )}
                      {columns.includes("classes") && (
                        <span className="text-xs">
                          {entry.student?.classes
                            ?.map((item) => item.short_name || item.long_name)
                            .join(" · ")}
                        </span>
                      )}
                      {columns.includes("parents") && (
                        <span className="text-xs">
                          {entry.student?.parents
                            ?.map((parent) =>
                              `${parent.first_name ?? ""} ${parent.last_name ?? ""}`.trim(),
                            )
                            .join(" · ")}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </section>
          );
        })}
      </div>
    </div>
  );
}
