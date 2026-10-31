"use client";

import { ProjectsCollection } from "@/features/projects/components/ProjectsCollection";
import { useAdminPageViewParam } from "@/shared/hooks/useAdminPageViewParam";
import { useQuickActions } from "@/shared/contexts/QuickActionsContext";
import { AdminPageActions } from "@/shared/components/AdminPageActions";
import { Button, ToolbarViewProvider } from "@altitutor/ui";
import { Plus } from "lucide-react";

export default function ProjectsPage() {
  const [view, setView] = useAdminPageViewParam(["list", "board"] as const, "board");
  const { openCreateProjectDialog } = useQuickActions();
  return (
    <ToolbarViewProvider value={{ value: view, options: [{ value: "list", label: "List" }, { value: "board", label: "Board" }], onChange: next => { if (next === "list" || next === "board") setView(next); } }}>
      <AdminPageActions><Button onClick={openCreateProjectDialog}><Plus />Add project</Button></AdminPageActions>
      <div className="p-6 space-y-4"><ProjectsCollection mode={view} /></div>
    </ToolbarViewProvider>
  );
}
