"use client";
import { TasksList } from "./TasksList";
import { TasksBoard } from "./TasksBoard";

/** Load both renderers together so changing layout does not cross another lazy boundary. */
export function TasksCollection({
  mode,
  defaultFilters,
}: {
  mode: "list" | "board";
  defaultFilters?: Record<string, unknown[]>;
}) {
  return mode === "board" ? (
    <TasksBoard defaultFilters={defaultFilters} />
  ) : (
    <TasksList defaultFilters={defaultFilters} />
  );
}
