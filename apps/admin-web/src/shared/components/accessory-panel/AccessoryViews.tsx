"use client";
import { Suspense } from "react";
import dynamic from "next/dynamic";
const TaskDetailView = dynamic(() =>
  import("@/features/tasks/components/TaskDetailView").then(
    (module) => module.TaskDetailView,
  ),
);
const IssueDetailView = dynamic(() =>
  import("@/features/issues/components/IssueDetailView").then(
    (module) => module.IssueDetailView,
  ),
);
const ProjectDetailView = dynamic(() =>
  import("@/features/projects/components/ProjectDetailView").then(
    (module) => module.ProjectDetailView,
  ),
);
const DocumentDetailView = dynamic(() =>
  import("@/features/notes/components/DocumentDetailView").then(
    (module) => module.DocumentDetailView,
  ),
);
const EmailThreadView = dynamic(() => import("@/features/email/components/EmailThreadView").then((module) => module.EmailThreadView));
const MessagesView = dynamic(() =>
  import("@/features/messages/components/MessagesView").then(
    (module) => module.MessagesView,
  ),
);
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
export function AccessoryView() {
  const scope = useAccessoryTab();
  if (!scope) return null;
  const { tab, close } = scope;
  let content;
  switch (tab.kind) {
    case "task":
      content = tab.id && (
        <TaskDetailView taskId={tab.id} variant="page" onClose={close} />
      );
      break;
    case "issue":
      content = tab.id && (
        <IssueDetailView issueId={tab.id} variant="page" onClose={close} />
      );
      break;
    case "project":
      content = tab.id && (
        <ProjectDetailView projectId={tab.id} variant="page" onClose={close} />
      );
      break;
    case "document":
      content = tab.id && (
        <DocumentDetailView noteId={tab.id} variant="page" onClose={close} />
      );
      break;
    case "email":
      content = tab.id && <EmailThreadView threadId={tab.id} />;
      break;
    case "messages":
      content = <MessagesView />;
      break;
  }
  return (
    <div className="h-full min-h-0 [&_[data-work-item-toolbar]]:flex-nowrap [&_[data-work-item-toolbar]>div:first-child]:min-w-0 [&_[data-entity-list-toolbar]]:border-b-0 [&_[data-pane-toolbar]]:px-4 [&_[data-pane-toolbar]]:py-2 [&_[data-pane-toolbar]]:min-h-14">
      <Suspense fallback={<p className="p-4">Loading…</p>}>{content}</Suspense>
    </div>
  );
}
