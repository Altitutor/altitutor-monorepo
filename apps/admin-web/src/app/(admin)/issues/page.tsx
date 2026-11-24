"use client";

import { Plus } from "lucide-react";

import { IssuesCollection } from "@/features/issues/components/IssuesCollection";
import { useAdminPageViewParam } from "@/shared/hooks/useAdminPageViewParam";
import { useQuickActions } from "@/shared/contexts/QuickActionsContext";
import { AdminPageActionButton } from "@/shared/components/admin-page-action-button";
import { AdminPageActions } from "@/shared/components/AdminPageActions";
import { ListSettingsMenu } from "@/shared/components/ListSettingsMenu";
import { ToolbarViewProvider } from "@altitutor/ui";

export default function IssuesPage() {
  const [view, setView] = useAdminPageViewParam(["list", "board"] as const, "board");
  const { openCreateIssueDialog } = useQuickActions();
  return (
    <ToolbarViewProvider value={{ value: view, options: [{ value: "list", label: "List" }, { value: "board", label: "Board" }], onChange: (next) => { if (next === "list" || next === "board") setView(next); } }}>
      <ListSettingsMenu list="issues" />
      <AdminPageActions><AdminPageActionButton icon={<Plus />} createShortcut label="Create issue" onClick={() => openCreateIssueDialog()} /></AdminPageActions>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden"><IssuesCollection mode={view} /></div>
    </ToolbarViewProvider>
  );
}
