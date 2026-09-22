"use client";

import { useWorkItemEditor } from "@/features/work-item-editing/useWorkItemEditor";
import {
  EditorCloseConfirmDialog,
  EditorControls,
  EditorFooterActions,
  EditorNotices,
  EditorViewSwitchConfirmDialog,
  WorkItemDialogHeaderActions,
  WorkItemEditableContext,
} from "@/features/work-item-editing/EditorControls";
import {
  taskFromRecord,
  taskToRecord,
} from "@/features/work-item-editing/fields";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  DialogTitle,
  DialogDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  type RichTextEditorRef,
  Button,
  Form,
} from "@altitutor/ui";
import { X, ArrowLeft, Loader2 } from "lucide-react";
import { useTask } from "../api/queries";
import type { Tables } from "@altitutor/shared";
import type { TaskFormData, TaskStatus } from "../types";
import { useNotes } from "@/shared/hooks/useNotes";
import { TaskPropertiesPanel, TaskContentPanel } from "./panels";
import { EntityResizablePanels } from "@/shared/components/EntityResizablePanels";
import { useTaskActions } from "../hooks/useTaskActions";
import { ActionsMenu } from "@/shared/components/ActionsMenu";
import { SaveAsTemplateDialog } from "@/features/rich-text-templates/components/SaveAsTemplateDialog";
import { EditIssueDialog } from "@/features/issues/components/EditIssueDialog";
import { EditProjectDialog } from "@/features/projects/components/EditProjectDialog";
import type { Resolver } from "react-hook-form";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z
    .union([z.record(z.unknown()), z.string(), z.null()])
    .optional(),
  status: z.enum(["backlog", "todo", "in_progress", "in_review", "done"]),
  priority: z.number().min(0).max(4),
  assignedTo: z.union([z.string().uuid(), z.null()]).default(null),
  issueId: z.union([z.string().uuid(), z.null()]).default(null),
  projectId: z.union([z.string().uuid(), z.null()]).default(null),
  estimate: z.preprocess(
    (val) => {
      if (
        val === null ||
        val === undefined ||
        val === "" ||
        val === 0 ||
        val === "none"
      ) {
        return null;
      }
      const num =
        typeof val === "string"
          ? Number(val)
          : typeof val === "number"
            ? val
            : null;
      return num !== null &&
        typeof num === "number" &&
        !isNaN(num) &&
        num >= 1 &&
        num <= 5
        ? num
        : null;
    },
    z.union([z.number().min(1).max(5), z.null()]).default(null),
  ),
  dueDate: z.union([z.string(), z.null()]).default(null),
});

export interface TaskDetailViewProps {
  taskId: string;
  enabled?: boolean;
  onClose: () => void;
  onTaskUpdated?: () => void;
  issue?: { id: string; name: string | null } | null;
  project?: { id: string; name: string | null } | null;
  variant: "dialog" | "page";
}

export function TaskDetailView({
  taskId,
  enabled = true,
  onClose,
  onTaskUpdated,
  issue,
  project,
  variant,
}: TaskDetailViewProps) {
  const router = useRouter();
  const { data: task, isLoading } = useTask(taskId, enabled);
  const [selectedAssignee, setSelectedAssignee] =
    useState<Tables<"staff"> | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<{
    id: string;
    name: string | null;
  } | null>(issue ?? null);
  const [selectedProject, setSelectedProject] = useState<{
    id: string;
    name: string | null;
  } | null>(project ?? null);
  const lastResetTaskIdRef = useRef<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const descriptionRef = useRef<RichTextEditorRef>(null);

  const { data: notesData } = useNotes("tasks", taskId, enabled);
  type NoteWithStaff = Tables<"notes"> & {
    staff?: Tables<"staff"> | null;
  };
  const notes = (notesData || []) as NoteWithStaff[];

  const form = useForm<TaskFormData, unknown, TaskFormData>({
    resolver: zodResolver(formSchema) as Resolver<TaskFormData>,
    defaultValues: {
      title: "",
      description: null,
      status: "backlog",
      priority: 0,
      assignedTo: null,
      issueId: null,
      projectId: null,
      estimate: null,
      dueDate: null,
    },
  });

  const editor = useWorkItemEditor({
    kind: "task",
    id: taskId,
    enabled,
    form,
    fromRecord: taskFromRecord,
    toRecord: taskToRecord,
    onClose,
  });

  useEffect(() => {
    if (
      task &&
      enabled &&
      !isLoading &&
      task.id !== lastResetTaskIdRef.current
    ) {
      if (task.assignee) {
        setSelectedAssignee({
          id: task.assignee.id,
          first_name: task.assignee.first_name,
          last_name: task.assignee.last_name,
        } as Tables<"staff">);
      } else {
        setSelectedAssignee(null);
      }

      setSelectedIssue(
        task.issue
          ? { id: task.issue.id, name: task.issue.name }
          : issue?.id
            ? { id: issue.id, name: issue.name }
            : null,
      );
      setSelectedProject(
        task.project
          ? { id: task.project.id, name: task.project.name }
          : project?.id
            ? { id: project.id, name: project.name }
            : null,
      );
      lastResetTaskIdRef.current = task.id;
    }
  }, [task, enabled, isLoading, form, issue, project]);

  useEffect(() => {
    if (!enabled) {
      lastResetTaskIdRef.current = null;
      setSelectedAssignee(null);
      setSelectedIssue(issue ?? null);
      setSelectedProject(project ?? null);
    }
  }, [enabled, issue, project]);

  const handleDelete = async () => {
    try {
      await editor.remove();
      onTaskUpdated?.();
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  const taskActions = useTaskActions({
    taskId,
    onOpenInPage:
      variant === "dialog"
        ? () => {
            editor.requestClose(() => {
              router.push(`/tasks/${taskId}`);
              onClose();
            });
          }
        : undefined,
  });

  const title = isLoading
    ? "Loading..."
    : variant === "page"
      ? "Task Details"
      : "Edit Task";

  return (
    <>
      <div className="h-full min-h-0 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 border-b bg-card px-6 py-4">
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3 flex-1">
              <Button
                variant={variant === "page" ? "ghost" : "outline"}
                size="icon"
                aria-label="Close"
                  onClick={() => editor.requestClose()}
                className={variant === "page" ? "shrink-0 border" : "shrink-0"}
              >
                {variant === "page" ? (
                  <ArrowLeft className="h-4 w-4" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </Button>
              <div className="flex-1">
                {variant === "dialog" ? (
                  <>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription className="sr-only">
                      Edit the details, description, and properties of this
                      task.
                    </DialogDescription>
                  </>
                ) : (
                  <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {variant === "dialog" ? (
                <WorkItemDialogHeaderActions
                  editor={editor}
                  actions={
                    <ActionsMenu
                      type="task"
                      entityId={taskId}
                      onOpenInPage={taskActions.onOpenInPage}
                      onDelete={() => {
                        if (editor.editable) setIsDeleteDialogOpen(true);
                      }}
                      richTextTemplateConfig={{
                        getEditor: () =>
                          editor.editable
                            ? descriptionRef.current?.getEditor() ?? null
                            : null,
                        getCurrentContent: () =>
                          form.getValues("description") ?? null,
                        onSaveAsTemplateClick: () => setIsSaveDialogOpen(true),
                      }}
                    />
                  }
                />
              ) : (
                <EditorControls editor={editor} />
              )}
            </div>
          </div>
        </div>

        <EditorNotices editor={editor} />
        <div className="min-h-0 flex-1 overflow-hidden">
          {isLoading || !editor.session ? (
            <div className="p-6">Loading task data...</div>
          ) : !task ? (
            <div className="p-6">Task not found</div>
          ) : (
            <div className="h-full min-h-0 flex overflow-hidden">
              <WorkItemEditableContext.Provider value={editor.editable}>
                <Form {...form}>
                  <form
                    className="h-full flex-1 flex min-h-0 overflow-hidden"
                    onSubmit={(e) => e.preventDefault()}
                  >
                    <fieldset disabled={!editor.editable} className="contents">
                      <EntityResizablePanels
                        id={`task-${taskId}-panels`}
                        main={
                          <TaskContentPanel
                            form={form}
                            taskId={taskId}
                            notes={notes}
                            isOpen={enabled}
                            selectedAssignee={selectedAssignee}
                            onAssigneeChange={setSelectedAssignee}
                            taskStatus={task.status as TaskStatus}
                            enabled={enabled}
                            descriptionRef={descriptionRef}
                          />
                        }
                        sidebar={
                          <TaskPropertiesPanel
                            form={form}
                            selectedAssignee={selectedAssignee}
                            onAssigneeChange={setSelectedAssignee}
                            selectedIssue={selectedIssue}
                            selectedProject={selectedProject}
                            onLinkChange={(link) => {
                              if (!link) {
                                setSelectedIssue(null);
                                setSelectedProject(null);
                                form.setValue("issueId", null, {
                                  shouldDirty: true,
                                });
                                form.setValue("projectId", null, {
                                  shouldDirty: true,
                                });
                                return;
                              }

                              if (link.type === "issue") {
                                setSelectedIssue({
                                  id: link.id,
                                  name: link.name,
                                });
                                setSelectedProject(null);
                                form.setValue("issueId", link.id, {
                                  shouldDirty: true,
                                });
                                form.setValue("projectId", null, {
                                  shouldDirty: true,
                                });
                              } else {
                                setSelectedProject({
                                  id: link.id,
                                  name: link.name,
                                });
                                setSelectedIssue(null);
                                form.setValue("projectId", link.id, {
                                  shouldDirty: true,
                                });
                                form.setValue("issueId", null, {
                                  shouldDirty: true,
                                });
                              }
                            }}
                            onOpenIssue={(id) => setOpenIssueId(id)}
                            onOpenProject={(id) => setOpenProjectId(id)}
                            taskStatus={task.status as TaskStatus}
                            enabled={enabled}
                          />
                        }
                      />
                    </fieldset>
                  </form>
                </Form>
              </WorkItemEditableContext.Provider>
            </div>
          )}
        </div>
        {variant === "dialog" ? (
          <div className="shrink-0 border-t bg-card px-6 py-4">
            <EditorFooterActions editor={editor} />
          </div>
        ) : null}
      </div>

      {variant === "dialog" ? (
        <>
          <EditorCloseConfirmDialog editor={editor} />
          <EditorViewSwitchConfirmDialog editor={editor} />
        </>
      ) : null}

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              task and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!editor.editable || editor.deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {editor.deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <SaveAsTemplateDialog
        isOpen={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        initialContent={form.getValues("description") ?? null}
        onSuccess={() => setIsSaveDialogOpen(false)}
      />

      {openIssueId && (
        <EditIssueDialog
          isOpen={!!openIssueId}
          onClose={() => setOpenIssueId(null)}
          issueId={openIssueId}
        />
      )}
      {openProjectId && (
        <EditProjectDialog
          isOpen={!!openProjectId}
          onClose={() => setOpenProjectId(null)}
          projectId={openProjectId}
        />
      )}
    </>
  );
}
