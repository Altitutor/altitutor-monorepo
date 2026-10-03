"use client";
import { Suspense } from "react";
import dynamic from "next/dynamic";
const TodayView = dynamic(() =>
  import("./TodayView").then((module) => module.TodayView),
);
const TasksBoard = dynamic(() =>
  import("@/features/tasks/components/TasksBoard").then(
    (module) => module.TasksBoard,
  ),
);
const IssuesBoard = dynamic(() =>
  import("@/features/issues/components/IssuesBoard").then(
    (module) => module.IssuesBoard,
  ),
);
const ProjectsBoard = dynamic(() =>
  import("@/features/projects/components/ProjectsBoard").then(
    (module) => module.ProjectsBoard,
  ),
);
const TasksList = dynamic(() =>
  import("@/features/tasks/components/TasksList").then(
    (module) => module.TasksList,
  ),
);
const IssuesList = dynamic(() =>
  import("@/features/issues/components/IssuesList").then(
    (module) => module.IssuesList,
  ),
);
const ProjectsList = dynamic(() =>
  import("@/features/projects/components/ProjectsList").then(
    (module) => module.ProjectsList,
  ),
);
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
  const TaskView = board ? TasksBoard : TasksList;
  const IssueView = board ? IssuesBoard : IssuesList;
  const ProjectView = board ? ProjectsBoard : ProjectsList;
  let content;
  switch (tab.kind) {
    case "today":
      content = <TodayView />;
      break;
    case "tasks":
      content = isLoading ? (
        <p className="p-4">Loading tasks…</p>
      ) : (
        <TaskView
          defaultFilters={{
            status: ["backlog", "todo", "in_progress", "in_review"],
            ...(staff?.id ? { assignee: [staff.id] } : {}),
          }}
        />
      );
      break;
    case "issues":
      content = (
        <IssueView defaultFilters={{ status: ["open", "awaiting_response"] }} />
      );
      break;
    case "projects":
      content = (
        <ProjectView
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
    case "messages":
      content = <MessagesView />;
      break;
  }
  return (
    <div className="h-full min-h-0 [&_[data-entity-list-toolbar]]:border-b-0 [&_[data-pane-toolbar]]:px-4 [&_[data-pane-toolbar]]:py-2 [&_[data-pane-toolbar]]:min-h-14">
      <Suspense fallback={<p className="p-4">Loading…</p>}>{content}</Suspense>
    </div>
  );
}
