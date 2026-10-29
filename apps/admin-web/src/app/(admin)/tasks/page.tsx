"use client";

import { TasksCollection } from "@/features/tasks/components/TasksCollection";
import { useAdminPageViewParam } from "@/shared/hooks/useAdminPageViewParam";

export default function TasksPage() {
  const [view] = useAdminPageViewParam(["list", "board"] as const, "list");
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
      <TasksCollection mode={view} />
    </div>
  );
}
