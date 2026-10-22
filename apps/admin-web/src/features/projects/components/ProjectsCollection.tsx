"use client";
import { ProjectsList } from "./ProjectsList";
import { ProjectsBoard } from "./ProjectsBoard";

/** Load both renderers together so changing layout does not cross another lazy boundary. */
export function ProjectsCollection({
  mode,
  defaultFilters,
}: {
  mode: "list" | "board";
  defaultFilters?: Record<string, unknown[]>;
}) {
  return mode === "board" ? (
    <ProjectsBoard defaultFilters={defaultFilters} />
  ) : (
    <ProjectsList defaultFilters={defaultFilters} />
  );
}
