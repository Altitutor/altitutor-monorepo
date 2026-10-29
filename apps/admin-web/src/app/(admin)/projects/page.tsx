"use client";

import { ProjectsCollection } from "@/features/projects/components/ProjectsCollection";
import { useAdminPageViewParam } from "@/shared/hooks/useAdminPageViewParam";

export default function ProjectsPage() {
  const [view] = useAdminPageViewParam(["list", "board"] as const, "list");
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
      <ProjectsCollection mode={view} />
    </div>
  );
}
