"use client";

import { IssuesCollection } from "@/features/issues/components/IssuesCollection";
import { useAdminPageViewParam } from "@/shared/hooks/useAdminPageViewParam";
import { useQuickActions } from "@/shared/contexts/QuickActionsContext";
import { AdminPageActions } from "@/shared/components/AdminPageActions";
import { ListSettingsMenu } from "@/shared/components/ListSettingsMenu";
import { Button, EntityChipIcon, ToolbarViewProvider } from "@altitutor/ui";

export default function IssuesPage() {
  const [view, setView] = useAdminPageViewParam(["list", "board"] as const, "board");
  const { openCreateIssueDialog } = useQuickActions();
  return (
    <ToolbarViewProvider value={{ value: view, options: [{ value: "list", label: "List" }, { value: "board", label: "Board" }], onChange: (next) => { if (next === "list" || next === "board") setView(next); } }}>
      <ListSettingsMenu list="issues" />
      <AdminPageActions><Button variant="outline" size="icon" className="h-8 w-8 rounded-full" aria-label="Add issue" title="Add issue" onClick={() => openCreateIssueDialog()}><EntityChipIcon entityType="issue" /></Button></AdminPageActions>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden"><IssuesCollection mode={view} /></div>
    </ToolbarViewProvider>
  );
}
