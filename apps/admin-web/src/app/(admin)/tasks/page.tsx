"use client";

import { TasksCollection } from "@/features/tasks/components/TasksCollection";
import { useAdminPageViewParam } from "@/shared/hooks/useAdminPageViewParam";
import { useQuickActions } from "@/shared/contexts/QuickActionsContext";
import { AdminPageActions } from "@/shared/components/AdminPageActions";
import { Button, ToolbarViewProvider } from "@altitutor/ui";
import { Plus } from "lucide-react";

export default function TasksPage() {
  const [view, setView] = useAdminPageViewParam(["list", "board"] as const, "board");
  const { openCreateTaskDialog } = useQuickActions();
  return (
    <ToolbarViewProvider value={{ value: view, options: [{ value: "list", label: "List" }, { value: "board", label: "Board" }], onChange: next => { if (next === "list" || next === "board") setView(next); } }}>
      <AdminPageActions><Button onClick={openCreateTaskDialog}><Plus />Add task</Button></AdminPageActions>
      <div className="p-6 space-y-4"><TasksCollection mode={view} /></div>
    </ToolbarViewProvider>
  );
}
