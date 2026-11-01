"use client";

import { IssuesCollection } from "@/features/issues/components/IssuesCollection";
import { useAdminPageViewParam } from "@/shared/hooks/useAdminPageViewParam";
import { useQuickActions } from "@/shared/contexts/QuickActionsContext";
import { AdminPageActions } from "@/shared/components/AdminPageActions";
import { Button, ToolbarViewProvider } from "@altitutor/ui";
import { Plus } from "lucide-react";

export default function IssuesPage() {
  const [view, setView] = useAdminPageViewParam(
    ["list", "board"] as const,
    "board",
  );
  const { openCreateIssueDialog } = useQuickActions();
  return (
    <ToolbarViewProvider
      value={{
        value: view,
        options: [
          { value: "list", label: "List" },
          { value: "board", label: "Board" },
        ],
        onChange: (next) => {
          if (next === "list" || next === "board") setView(next);
        },
      }}
    >
      <AdminPageActions>
        <Button onClick={() => openCreateIssueDialog()}>
          <Plus />
          Add issue
        </Button>
      </AdminPageActions>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <IssuesCollection mode={view} />
      </div>
    </ToolbarViewProvider>
  );
}
