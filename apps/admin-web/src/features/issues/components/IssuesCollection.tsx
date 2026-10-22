"use client";
import { IssuesList } from "./IssuesList";
import { IssuesBoard } from "./IssuesBoard";

/** Load both renderers together so changing layout does not cross another lazy boundary. */
export function IssuesCollection({
  mode,
  defaultFilters,
}: {
  mode: "list" | "board";
  defaultFilters?: Record<string, unknown[]>;
}) {
  return mode === "board" ? (
    <IssuesBoard defaultFilters={defaultFilters} />
  ) : (
    <IssuesList defaultFilters={defaultFilters} />
  );
}
