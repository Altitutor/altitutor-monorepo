"use client";

import { useWorkItemEditor } from "@/features/work-item-editing/useWorkItemEditor";
import {
  EditorCloseConfirmDialog,
  EditorControls,
  EditorFooterActions,
  EditorNotices,
  WorkItemDialogHeaderActions,
  WorkItemEditableContext,
} from "@/features/work-item-editing/EditorControls";
import {
  projectFromRecord,
  projectToRecord,
} from "@/features/work-item-editing/fields";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
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
  Form,
  Button,
  Separator,
  Input,
  type RichTextEditorRef,
} from "@altitutor/ui";
import { X, ArrowLeft, Loader2, FileText, Plus } from "lucide-react";
import { useProject } from "../api/queries";
import type { ProjectFormData } from "../types";
import { ProjectTitleField } from "./fields/ProjectTitleField";
import { ProjectDescriptionField } from "./fields/ProjectDescriptionField";
import { ProjectPropertiesFields } from "./fields/ProjectPropertiesFields";
import { useProjectActions } from "../hooks/useProjectActions";
import { LinkedTasksSection } from "@/features/tasks/components/LinkedTasksSection";
import { useNotes } from "@/features/notes/api/queries";
import { useCreateNote } from "@/features/notes/hooks/useNoteMutations";
import { EditDocumentDialog } from "@/features/notes/components/EditDocumentDialog";
import { ActivityFeed } from "@/features/activity/components/ActivityFeed";
import { useProjectActivity } from "@/features/activity/hooks";
import { useNotes as useEntityNotes } from "@/shared/hooks/useNotes";
import { ProjectNotes } from "./ProjectNotes";
import { ProjectPropertyPills } from "./fields/ProjectPropertyPills";
import { ActionsMenu } from "@/shared/components/ActionsMenu";
import { SaveAsTemplateDialog } from "@/features/rich-text-templates/components/SaveAsTemplateDialog";
import { EntityResizablePanels } from "@/shared/components/EntityResizablePanels";
import {
  EntitySidebarCard,
  EntitySidebarCards,
} from "@/shared/components/EntitySidebarCard";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z
    .union([z.record(z.unknown()), z.string(), z.null()])
    .optional(),
  status: z.enum(["backlog", "planned", "in_progress", "completed"]),
  priority: z.number().min(0).max(4),
  projectLeadId: z.union([z.string().uuid(), z.null()]).default(null),
  memberIds: z.array(z.string().uuid()).default([]),
  startDate: z.union([z.string(), z.null()]).default(null),
  targetDate: z.union([z.string(), z.null()]).default(null),
});

export interface ProjectDetailViewProps {
  projectId: string;
  enabled?: boolean;
  onClose: () => void;
  variant: "dialog" | "page";
}

export function ProjectDetailView({
  projectId,
  enabled = true,
  onClose,
  variant,
}: ProjectDetailViewProps) {
  const router = useRouter();
  const { data: project, isLoading } = useProject(projectId, enabled);
  const { data: projectNotes = [] } = useNotes(
    { projectId: projectId && projectId.trim() ? projectId : undefined },
    enabled,
  );
  const { data: progressNotesData = [] } = useEntityNotes(
    "projects",
    projectId,
    enabled,
  );
  const createNote = useCreateNote();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null,
  );
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [documentInitialMode, setDocumentInitialMode] = useState<
    "view" | "edit"
  >("view");
  const [newDocumentTitle, setNewDocumentTitle] = useState("");
  const titleFieldRef = useRef<HTMLInputElement>(null);
  const descriptionFieldRef = useRef<RichTextEditorRef>(null);
  const {
    data: projectActivity,
    isLoading: isProjectActivityLoading,
    error: projectActivityError,
  } = useProjectActivity(projectId, enabled, 100);

  const form = useForm<ProjectFormData, unknown, ProjectFormData>({
    resolver: zodResolver(formSchema) as Resolver<ProjectFormData>,
    defaultValues: {
      name: "",
      description: null,
      status: "backlog",
      priority: 0,
      projectLeadId: null,
      memberIds: [],
      startDate: null,
      targetDate: null,
    },
  });

  const editor = useWorkItemEditor({
    kind: "project",
    id: projectId,
    enabled,
    form,
    fromRecord: projectFromRecord,
    toRecord: projectToRecord,
    onClose,
  });


  const handleTitleEnter = useCallback(() => {
    const editor = descriptionFieldRef.current?.getEditor();
    if (
      editor &&
      editor.commands &&
      typeof editor.commands.focus === "function"
    ) {
      editor.commands.focus();
    }
  }, []);

  const handleDelete = async () => {
    try {
      await editor.remove();
    } catch (error) {
      console.error("Failed to delete project:", error);
    }
  };

  const handleAddDocument = useCallback(
    async (title: string) => {
      try {
        const created = await createNote.mutateAsync({
          title: title.trim() || "Untitled",
          content: "",
          folder_id: null,
          project_id: projectId,
        });
        setNewDocumentTitle("");
        setDocumentInitialMode("edit");
        setSelectedDocumentId(created.id);
        setIsDocumentDialogOpen(true);
      } catch (error) {
        console.error("Failed to create document:", error);
      }
    },
    [projectId, createNote],
  );

  const projectActions = useProjectActions({
    projectId,
    onOpenInPage:
      variant === "dialog"
        ? () => {
            editor.requestClose(() => {
              router.push(`/projects/${projectId}`);
              onClose();
            });
          }
        : undefined,
  });

  const title = isLoading
    ? "Loading..."
    : variant === "page"
      ? "Project Details"
      : "Edit Project";

  const documentsList = (
    <div className="space-y-0.5">
      {projectNotes.map((doc) => (
        <button
          type="button"
          key={doc.id}
          className="w-full flex items-center gap-2 py-2 px-2 rounded-md hover:bg-muted/50 text-left text-sm"
          onClick={() => {
            setDocumentInitialMode("view");
            setSelectedDocumentId(doc.id);
            setIsDocumentDialogOpen(true);
          }}
        >
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="flex-1 truncate">{doc.title}</span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {new Date(doc.updated_at).toLocaleDateString()}
          </span>
        </button>
      ))}
      <div className="flex items-center gap-2 py-2 px-2 rounded-md text-sm">
        <FileText className="h-4 w-4 text-muted-foreground/70 flex-shrink-0" />
        <Input
          placeholder="Create new document..."
          value={newDocumentTitle}
          onChange={(e) => setNewDocumentTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddDocument(newDocumentTitle);
            }
          }}
          className="flex-1 min-w-0 h-8 text-sm placeholder:opacity-70 border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button
          type="button"
          variant="default"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          disabled={createNote.isPending}
          onClick={() => handleAddDocument(newDocumentTitle)}
        >
          {createNote.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );

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
                      Edit project details, linked tasks, and linked documents.
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
                      type="project"
                      entityId={projectId}
                      onOpenInPage={projectActions.onOpenInPage}
                      onDelete={() => {
                        if (editor.editable) setIsDeleteDialogOpen(true);
                      }}
                      richTextTemplateConfig={{
                        getEditor: () =>
                          editor.editable
                            ? descriptionFieldRef.current?.getEditor() ?? null
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
            <div className="p-6">Loading project data...</div>
          ) : !project ? (
            <div className="p-6">Project not found</div>
          ) : (
            <WorkItemEditableContext.Provider value={editor.editable}>
              <Form {...form}>
                <form
                  className="h-full min-h-0 flex min-w-0 overflow-hidden"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <fieldset disabled={!editor.editable} className="contents">
                    <EntityResizablePanels
                      id={`project-${projectId}-panels`}
                      main={
                        <div
                          className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain"
                          data-rich-text-toolbar-container
                        >
                          <div className="p-6 space-y-6">
                            <ProjectPropertyPills
                              form={form}
                              enabled={enabled}
                              knownMembers={project.members}
                            />

                            <ProjectTitleField
                              form={form}
                              onEnter={handleTitleEnter}
                              titleRef={titleFieldRef}
                            />
                            <ProjectDescriptionField
                              form={form}
                              descriptionRef={descriptionFieldRef}
                            />

                            <Separator />
                            <LinkedTasksSection projectId={projectId} />

                            <Separator />
                            <ProjectNotes
                              projectId={projectId}
                              notes={progressNotesData}
                              onNoteAdded={() => {}}
                            />

                            <Separator />
                            <div className="space-y-4">
                              <h3 className="text-lg font-semibold">
                                Activity
                              </h3>
                              <ActivityFeed
                                data={projectActivity}
                                isLoading={isProjectActivityLoading}
                                error={projectActivityError}
                              />
                            </div>

                            <div className="space-y-4 md:hidden">
                              <Separator />
                              <h3 className="text-lg font-semibold">
                                Documents
                              </h3>
                              {documentsList}
                            </div>
                          </div>
                        </div>
                      }
                      sidebar={
                        <div className="hidden h-full min-h-0 w-full flex-col overflow-hidden md:flex">
                          <EntitySidebarCards
                            defaultOpen={["properties", "documents"]}
                          >
                            <EntitySidebarCard
                              value="properties"
                              title="Properties"
                            >
                              <ProjectPropertiesFields
                                form={form}
                                knownMembers={project.members}
                              />
                            </EntitySidebarCard>
                            <EntitySidebarCard
                              value="documents"
                              title="Documents"
                            >
                              {documentsList}
                            </EntitySidebarCard>
                          </EntitySidebarCards>
                        </div>
                      }
                    />
                  </fieldset>
                </form>
              </Form>
            </WorkItemEditableContext.Provider>
          )}
        </div>
        {variant === "dialog" ? (
          <div className="shrink-0 border-t bg-card px-6 py-4">
            <EditorFooterActions editor={editor} />
          </div>
        ) : null}
      </div>

      <EditorCloseConfirmDialog editor={editor} />

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              project.
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

      <EditDocumentDialog
        isOpen={isDocumentDialogOpen}
        onClose={() => {
          setIsDocumentDialogOpen(false);
          setSelectedDocumentId(null);
          setDocumentInitialMode("view");
        }}
        noteId={selectedDocumentId}
        initialMode={documentInitialMode}
      />
    </>
  );
}
