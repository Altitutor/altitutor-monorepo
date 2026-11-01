"use client";
const TasksCollection = dynamic(() =>
  import("@/features/tasks/components/TasksCollection").then(
    (module) => module.TasksCollection,
  ),
);
const IssuesCollection = dynamic(() =>
  import("@/features/issues/components/IssuesCollection").then(
    (module) => module.IssuesCollection,
  ),
);
const ProjectsCollection = dynamic(() =>
  import("@/features/projects/components/ProjectsCollection").then(
    (module) => module.ProjectsCollection,
  ),
);
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
const DocumentsView = dynamic(() =>
  import("@/features/notes/components/DocumentsView").then(
    (module) => module.DocumentsView,
  ),
);
const EmailThreadView = dynamic(() => import("@/features/email/components/EmailThreadView").then((module) => module.EmailThreadView));
const MailPage = dynamic(() => import("@/features/email/components/MailPage").then((module) => module.MailPage));
const MessagesView = dynamic(() =>
  import("@/features/messages/components/MessagesView").then(
    (module) => module.MessagesView,
  ),
);
import { useCurrentStaff } from "@/shared/hooks";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
export function AccessoryView() {
  const scope = useAccessoryTab();
  const { data: staff, isLoading } = useCurrentStaff();
  if (!scope) return null;
  const { tab, close } = scope;
  const board = new URLSearchParams(tab.query).get("view") === "board";
  let content;
  switch (tab.kind) {
    case "tasks":
      content = isLoading ? (
        <p className="p-4">Loading tasks…</p>
      ) : (
        <TasksCollection
          mode={board ? "board" : "list"}
          defaultFilters={{
            status: ["backlog", "todo", "in_progress", "in_review"],
            ...(staff?.id ? { assignee: [staff.id] } : {}),
          }}
        />
      );
      break;
    case "issues":
      content = (
        <IssuesCollection
          mode={board ? "board" : "list"}
          defaultFilters={{ status: ["open", "awaiting_response"] }}
        />
      );
      break;
    case "projects":
      content = (
        <ProjectsCollection
          mode={board ? "board" : "list"}
          defaultFilters={{ status: ["backlog", "planned", "in_progress"] }}
        />
      );
      break;
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
    case "documents":
      content = <DocumentsView />;
      break;
    case "email":
      content = tab.id ? <EmailThreadView threadId={tab.id} /> : <MailPage />;
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
