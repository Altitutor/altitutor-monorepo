"use client";
import { RetainedDeletionMessage } from "@/shared/components/RetainedDeletionMessage";

import { AccessoryBreadcrumb } from "@/shared/components/accessory-panel/AccessoryBreadcrumb";
import { useAccessoryTitle } from "@/shared/hooks/useAccessoryTitle";

import { useWorkItemEditor } from "@/features/work-item-editing/useWorkItemEditor";
import {
  EditorCloseConfirmDialog,
  EditorControls,
  EditorFooterActions,
  EditorNotices,
  WorkItemEditableContext,
} from "@/features/work-item-editing/EditorControls";
import {
  projectFromRecord,
  projectToRecord,
} from "@/features/work-item-editing/fields";

import { useState, useRef, useCallback } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
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
  Skeleton,
  SegmentedTabPanel,
  SegmentedTabPanelContent,
  Input,
  type RichTextEditorRef,
} from "@altitutor/ui";
import { Loader2, FileText, Plus } from "lucide-react";
import { useProject } from "../api/queries";
import type { ProjectFormData } from "../types";
import { ProjectTitleField } from "./fields/ProjectTitleField";
import { ProjectDescriptionField } from "./fields/ProjectDescriptionField";
import { ProjectPropertyPills } from "./fields/ProjectPropertyPills";
import { ProjectPropertiesFields } from "./fields/ProjectPropertiesFields";
import { LinkedTasksSection } from "@/features/tasks/components/LinkedTasksSection";
import { useNotes } from "@/features/notes/api/queries";
import { NotesSearchResults } from "@/features/notes/components/NotesSearchResults";
import { DocumentsToolbar } from "@/features/notes/components/DocumentsToolbar";
import { defaultDocumentOrder } from "@/features/notes/utils/documentOrder";
import { useCreateNote } from "@/features/notes/hooks/useNoteMutations";
import { EditDocumentDialog } from "@/features/notes/components/EditDocumentDialog";
import { WorkItemActivity } from "@/features/activity/components/WorkItemActivity";
import { useProjectActivity } from "@/features/activity/hooks";
import { useNotes as useEntityNotes } from "@/shared/hooks/useNotes";
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
    .union([z.record(z.string(), z.unknown()), z.string(), z.null()])
    .optional(),
  status: z.enum(["backlog", "planned", "in_progress", "completed"]),
  priority: z.number().min(0).max(4),
  projectLeadId: z.union([z.string().guid('Invalid uuid'), z.null()]).default(null),
  memberIds: z.array(z.string().guid('Invalid uuid')).default([]),
  startDate: z.union([z.string(), z.null()]).default(null),
  targetDate: z.union([z.string(), z.null()]).default(null),
});

type ProjectSection = "overview" | "tasks" | "documents" | "activity";

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
  const [sidebarToggleTarget, setSidebarToggleTarget] = useState<HTMLDivElement | null>(null);
  const { data: project, isLoading } = useProject(projectId, enabled);
  useAccessoryTitle(project?.name);
  const [section, setSection] = useState<ProjectSection>("overview");
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentOrder, setDocumentOrder] = useState(defaultDocumentOrder);
  const search = documentSearch.trim();
  const documents = useNotes(
    { projectId },
    enabled && Boolean(projectId) && (section !== "documents" || !search),
  );
  const documentResults = useNotes(
    { projectId, search },
    enabled && Boolean(projectId && search) && section === "documents",
  );
  const visibleDocuments = search ? documentResults : documents;
  const { data: progressNotesData = [] } = useEntityNotes(
    "projects",
    projectId,
    enabled && section === "activity",
  );
  const createNote = useCreateNote();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null,
  );
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [newDocumentTitle, setNewDocumentTitle] = useState("");
  const titleFieldRef = useRef<HTMLInputElement>(null);
  const descriptionFieldRef = useRef<RichTextEditorRef>(null);
  const {
    data: projectActivity,
    isLoading: isProjectActivityLoading,
    error: projectActivityError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useProjectActivity(projectId, enabled && section === "activity", 100);

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
      if (createNote.isPending) return;
      try {
        const created = await createNote.mutateAsync({
          title: title.trim() || "Untitled",
          content: "",
          folder_id: null,
          project_id: projectId,
        });
        setNewDocumentTitle("");
        setSelectedDocumentId(created.id);
        setIsDocumentDialogOpen(true);
      } catch (error) {
        console.error("Failed to create document:", error);
      }
    },
    [projectId, createNote],
  );

  const openDocument = (id: string) => {
    setSelectedDocumentId(id);
    setIsDocumentDialogOpen(true);
  };

  const createDocumentRow = (
    <div className="flex items-center gap-2 rounded-md px-2 py-2 text-sm">
      <FileText className="size-4 shrink-0 text-muted-foreground" />
      <Input
        aria-label="New document title"
        placeholder="Create new document..."
        value={newDocumentTitle}
        onChange={(e) => setNewDocumentTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void handleAddDocument(newDocumentTitle);
          }
        }}
        className="h-8 min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <Button
        type="button"
        variant="default"
        size="icon"
        className="size-8 shrink-0"
        aria-label="Create document"
        disabled={createNote.isPending}
        onClick={() => void handleAddDocument(newDocumentTitle)}
      >
        {createNote.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plus className="size-4" />
        )}
      </Button>
    </div>
  );

  return (
    <>
      <div className="h-full min-h-0 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 border-b bg-background px-4 py-2">
          <div className="flex min-w-0 items-center justify-between gap-2 w-full">
            <AccessoryBreadcrumb />

            <div className="flex shrink-0 items-center gap-2">
              {
                <>
                  <EditorControls editor={editor} />
                  <div ref={setSidebarToggleTarget} className="empty:hidden" />
                  <ActionsMenu
                    type="project"
                    entityId={projectId}
                    copyTagDisplayText={
                      form.watch("name") || project?.name || "Untitled project"
                    }
                    onDelete={() => {
                      if (editor.editable) setIsDeleteDialogOpen(true);
                    }}
                    richTextTemplateConfig={{
                      getEditor: () =>
                        editor.editable
                          ? (descriptionFieldRef.current?.getEditor() ?? null)
                          : null,
                      getCurrentContent: () =>
                        form.getValues("description") ?? null,
                      onSaveAsTemplateClick: () => setIsSaveDialogOpen(true),
                    }}
                  />
                </>
              }
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
                      toggleTarget={sidebarToggleTarget}
                      id={`project-${projectId}-panels`}
                      main={
                        <SegmentedTabPanel<ProjectSection>
                          className="h-full"
                          selectorClassName="mx-6 mt-6 w-auto"
                          value={section}
                          onValueChange={setSection}
                          options={[
                            { value: "overview", label: "Overview" },
                            { value: "tasks", label: "Tasks" },
                            { value: "documents", label: "Documents" },
                            { value: "activity", label: "Activity" },
                          ]}
                        >
                          <SegmentedTabPanelContent when="overview" activeTab={section} className="min-h-0 flex-1">
                            <div className="h-full space-y-6 overflow-y-auto overscroll-contain p-6" data-rich-text-toolbar-container>
                              <ProjectTitleField
                                form={form}
                                onEnter={handleTitleEnter}
                                titleRef={titleFieldRef}
                              />
                              <ProjectPropertyPills form={form} enabled={enabled} knownMembers={project.members} />
                              <ProjectDescriptionField
                                form={form}
                                descriptionRef={descriptionFieldRef}
                              />
                            </div>
                          </SegmentedTabPanelContent>
                          <SegmentedTabPanelContent when="tasks" activeTab={section} className="mt-2 min-h-0 flex-1 overflow-hidden">
                            <LinkedTasksSection projectId={projectId} />
                          </SegmentedTabPanelContent>
                          <SegmentedTabPanelContent when="documents" activeTab={section} className="flex min-h-0 flex-1 flex-col gap-2 px-6 pb-6 pt-4">
                            <DocumentsToolbar
                              project
                              search={documentSearch}
                              onSearchChange={setDocumentSearch}
                              order={documentOrder}
                              onOrderChange={setDocumentOrder}
                            />
                            <div className="min-h-0 flex-1 overflow-y-auto">
                              {visibleDocuments.isLoading ? (
                                <div role="status" aria-label="Loading documents" className="space-y-2 py-2">
                                  <Skeleton className="h-8 w-full" />
                                  <Skeleton className="h-8 w-full" />
                                </div>
                              ) : visibleDocuments.error ? (
                                <p role="alert" className="p-2 text-sm text-destructive">Could not load project documents.</p>
                              ) : visibleDocuments.data?.length || search ? (
                                <NotesSearchResults
                                  notes={visibleDocuments.data ?? []}
                                  searchQuery={search}
                                  order={documentOrder}
                                  onNoteClick={openDocument}
                                />
                              ) : (
                                <p className="p-2 text-sm text-muted-foreground">No documents in this project yet.</p>
                              )}
                              {!search && createDocumentRow}
                            </div>
                          </SegmentedTabPanelContent>
                          <SegmentedTabPanelContent when="activity" activeTab={section} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
                            <WorkItemActivity
                              kind="project"
                              entityId={projectId}
                              notes={progressNotesData}
                              data={projectActivity}
                              isLoading={isProjectActivityLoading}
                              error={projectActivityError}
                              hasNextPage={hasNextPage}
                              isFetchingNextPage={isFetchingNextPage}
                              onLoadMore={fetchNextPage}
                            />
                          </SegmentedTabPanelContent>
                        </SegmentedTabPanel>
                      }
                      sidebar={
                        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
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
                              {documents.data?.map((doc) => (
                                <button
                                  key={doc.id}
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted/50"
                                  onClick={() => openDocument(doc.id)}
                                >
                                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                                  <span className="min-w-0 flex-1 truncate">{doc.title}</span>
                                  <span className="shrink-0 text-xs text-muted-foreground">{new Date(doc.updated_at).toLocaleDateString()}</span>
                                </button>
                              ))}
                              {section !== "documents" && createDocumentRow}
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
              <RetainedDeletionMessage  />
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
        }}
        noteId={selectedDocumentId}
      />
    </>
  );
}
