"use client";

import { IssuesCollection } from "@/features/issues/components/IssuesCollection";
import { useAdminPageViewParam } from "@/shared/hooks/useAdminPageViewParam";

export default function IssuesPage() {
  const [view] = useAdminPageViewParam(["list", "board"] as const, "list");
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Issues</h1>
      <IssuesCollection mode={view} />
    </div>
  );
}
