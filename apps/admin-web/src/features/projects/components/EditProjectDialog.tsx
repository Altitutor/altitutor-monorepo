'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useForm, type UseFormReturn, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
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
  Card,
  CardContent,
  ScrollArea,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Input,
  type RichTextEditorRef,
} from '@altitutor/ui';
import { X, Check, Loader2, CloudOff, Settings, FileText, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useProject } from '../api/queries';
import { useUpdateProject, useDeleteProject } from '../api/mutations';
import type { ProjectFormData, ProjectStatus } from '../types';
import type { JSONContent } from '@altitutor/ui';

const VALID_PROJECT_STATUSES: ProjectStatus[] = ['backlog', 'planned', 'in_progress', 'completed'];

function normalizeProjectStatus(status: string | null | undefined): ProjectStatus {
  if (status && VALID_PROJECT_STATUSES.includes(status as ProjectStatus)) {
    return status as ProjectStatus;
  }
  return 'backlog';
}
import { ProjectTitleField } from './fields/ProjectTitleField';
import { ProjectDescriptionField } from './fields/ProjectDescriptionField';
import { ProjectPropertiesFields } from './fields/ProjectPropertiesFields';
import { useProjectAutoSave } from '../hooks/useProjectAutoSave';
import { TasksList } from '@/features/tasks/components/TasksList';
import { useNotes } from '@/features/notes/api/queries';
import { useCreateNote } from '@/features/notes/hooks/useNoteMutations';
import { EditDocumentDialog } from '@/features/notes/components/EditDocumentDialog';
import { useTasks } from '@/features/tasks/api/queries';
import { activityApi } from '@/features/activity/api';
import { ActivityFeed } from '@/features/activity/components/ActivityFeed';
import { useNotes as useEntityNotes } from '@/shared/hooks/useNotes';
import { ProjectNotes } from './ProjectNotes';
import { ProjectPropertyPills } from './fields/ProjectPropertyPills';
import { ActionsMenu } from '@/shared/components/ActionsMenu';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.union([z.record(z.unknown()), z.string(), z.null()]).optional(),
  status: z.enum(['backlog', 'planned', 'in_progress', 'completed']),
  priority: z.number().min(0).max(4),
  projectLeadId: z.union([z.string().uuid(), z.null()]).default(null),
  startDate: z.union([z.string(), z.null()]).default(null),
  targetDate: z.union([z.string(), z.null()]).default(null),
});

interface EditProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
}

interface AutoSaveManagerProps {
  form: UseFormReturn<ProjectFormData>;
  projectId: string;
  project: { id: string } | undefined;
  isInitialized: boolean;
  isLoading: boolean;
  onSave: (updates: Partial<ProjectFormData>) => Promise<void>;
}

function AutoSaveManager({ form, projectId, project, isInitialized, isLoading, onSave }: AutoSaveManagerProps) {
  useProjectAutoSave({
    form,
    projectId,
    project,
    isInitialized,
    isUpdatingFromServer: isLoading,
    onSave,
  });
  return null;
}

export function EditProjectDialog({ isOpen, onClose, projectId }: EditProjectDialogProps) {
  const { data: project, isLoading } = useProject(projectId || '', !!projectId && isOpen);
  const { data: projectNotes = [] } = useNotes({ projectId: projectId || '' });
  const { data: progressNotesData = [] } = useEntityNotes('projects', projectId || '', !!projectId && isOpen);
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const createNote = useCreateNote();
  const lastResetProjectIdRef = useRef<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [newDocumentTitle, setNewDocumentTitle] = useState('');
  const titleFieldRef = useRef<HTMLDivElement>(null);
  const descriptionFieldRef = useRef<RichTextEditorRef>(null);
  const { data: linkedTasks = [] } = useTasks(projectId ? { project_id: [projectId] } : undefined);

  const taskIds = useMemo(() => linkedTasks.map((task) => task.id), [linkedTasks]);
  const { data: projectActivity, isLoading: isProjectActivityLoading, error: projectActivityError } = useQuery({
    queryKey: ['project-linked-task-activity', projectId, taskIds],
    queryFn: async () =>
      activityApi.getActivityEvents({
        or: `task_id.in.(${taskIds.join(',')})`,
        limit: 100,
      }),
    enabled: isOpen && !!projectId && taskIds.length > 0,
  });

  const form = useForm<ProjectFormData, unknown, ProjectFormData>({
    resolver: zodResolver(formSchema) as Resolver<ProjectFormData>,
    defaultValues: {
      name: '',
      description: null,
      status: 'backlog',
      priority: 0,
      projectLeadId: null,
      startDate: null,
      targetDate: null,
    },
  });

  useEffect(() => {
    if (project && isOpen && !isLoading && project.id !== lastResetProjectIdRef.current) {
      form.reset({
        name: project.name,
        description: (project.description as JSONContent | null) ?? null,
        status: normalizeProjectStatus(project.status),
        priority: (project.priority ?? 0) as ProjectFormData['priority'],
        projectLeadId: project.project_lead_id || null,
        startDate: project.start_date ? new Date(project.start_date).toISOString().split('T')[0] : null,
        targetDate: project.target_date ? new Date(project.target_date).toISOString().split('T')[0] : null,
      });
      lastResetProjectIdRef.current = project.id;
      setIsInitialized(true);
    }
  }, [project, isOpen, isLoading, form]);

  useEffect(() => {
    if (!isOpen) {
      lastResetProjectIdRef.current = null;
      setIsInitialized(false);
    }
  }, [isOpen]);

  const handleTitleEnter = useCallback(() => {
    const editor = descriptionFieldRef.current?.getEditor();
    if (editor && editor.commands && typeof editor.commands.focus === 'function') {
      editor.commands.focus();
    }
  }, []);

  const handleAutoSave = useCallback(async (updates: Partial<ProjectFormData>) => {
    if (!projectId) return;

    try {
      const formattedUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) formattedUpdates.name = updates.name;
      if (updates.description !== undefined) formattedUpdates.description = updates.description;
      if (updates.priority !== undefined) formattedUpdates.priority = updates.priority;
      if (updates.projectLeadId !== undefined) {
        formattedUpdates.project_lead_id = updates.projectLeadId;
      }
      if (updates.startDate !== undefined) {
        formattedUpdates.start_date = updates.startDate ? new Date(updates.startDate).toISOString() : null;
      }
      if (updates.targetDate !== undefined) {
        formattedUpdates.target_date = updates.targetDate ? new Date(updates.targetDate).toISOString() : null;
      }
      if (updates.status !== undefined) {
        formattedUpdates.status = normalizeProjectStatus(updates.status);
      }

      if (Object.keys(formattedUpdates).length === 0) return;

      await updateProject.mutateAsync({
        id: projectId,
        updates: formattedUpdates as import('../types').ProjectUpdate,
      });
    } catch (error) {
      console.error('Failed to auto-save project:', error);
    }
  }, [projectId, updateProject]);

  const handleDelete = async () => {
    if (!projectId) return;
    try {
      await deleteProject.mutateAsync(projectId);
      onClose();
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const handleAddDocument = useCallback(
    async (title: string) => {
      if (!projectId) return;
      try {
        const created = await createNote.mutateAsync({
          title: title.trim() || 'Untitled',
          content: '',
          folder_id: null,
          project_id: projectId,
        });
        setNewDocumentTitle('');
        setSelectedDocumentId(created.id);
        setIsDocumentDialogOpen(true);
      } catch (error) {
        console.error('Failed to create document:', error);
      }
    },
    [projectId, createNote]
  );

  if (!projectId || !isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden">
          <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
            <div className="flex items-center justify-between gap-4 w-full">
              <div className="flex items-center gap-3 flex-1">
                <Button variant="outline" size="icon" onClick={onClose} className="shrink-0">
                  <X className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                  <DialogTitle>{isLoading ? 'Loading...' : 'Edit Project'}</DialogTitle>
                  <DialogDescription className="sr-only">
                    Edit project details, linked tasks, and linked documents.
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium pr-2 mr-2">
                  {updateProject.isPending ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : updateProject.isError ? (
                    <>
                      <CloudOff className="h-3 w-3 text-destructive" />
                      <span className="text-destructive">Changes not saved</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" />
                      <span>Saved</span>
                    </>
                  )}
                </div>
                <ActionsMenu
                  type="project"
                  entityId={projectId}
                  onOpenInPage={() => {}}
                  onDelete={() => setIsDeleteDialogOpen(true)}
                />
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden min-h-0">
            {isLoading ? (
              <div className="p-6">Loading project data...</div>
            ) : !project ? (
              <div className="p-6">Project not found</div>
            ) : (
              <Form {...form}>
                <form className="h-full flex min-w-0">
                  <AutoSaveManager
                    form={form}
                    projectId={projectId}
                    project={project}
                    isInitialized={isInitialized}
                    isLoading={isLoading}
                    onSave={handleAutoSave}
                  />

                  <div className="flex-1 flex flex-col min-w-0 border-r">
                    <ScrollArea className="flex-1 min-w-0 max-w-full">
                      <div className="p-6 space-y-6">
                        <ProjectPropertyPills form={form} enabled={isOpen} />

                        <ProjectTitleField
                          form={form}
                          value={form.watch('name')}
                          onEnter={handleTitleEnter}
                          titleRef={titleFieldRef}
                        />
                        <ProjectDescriptionField
                          form={form}
                          value={form.watch('description') as JSONContent | null}
                          descriptionRef={descriptionFieldRef}
                        />

                        <Separator />
                        <div className="space-y-4 min-w-0 max-w-full">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Linked Tasks</h3>
                          </div>
                          <div className="border-y bg-background overflow-hidden w-full min-w-0 max-w-full">
                            <TasksList
                              projectId={projectId}
                              compact
                              hideToolbar
                              showProjectPill={false}
                              showLinkPill={false}
                              noPadding
                            />
                          </div>
                        </div>

                        <Separator />
                        <ProjectNotes
                          projectId={projectId}
                          notes={progressNotesData}
                          onNoteAdded={() => {}}
                        />

                        <Separator />
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">Activity</h3>
                          {taskIds.length === 0 ? (
                            <Card>
                              <CardContent className="p-4 text-sm text-muted-foreground">
                                No linked tasks yet.
                              </CardContent>
                            </Card>
                          ) : (
                            <ActivityFeed
                              data={projectActivity}
                              isLoading={isProjectActivityLoading}
                              error={projectActivityError as Error | null}
                            />
                          )}
                        </div>

                        <div className="space-y-4 md:hidden">
                          <Separator />
                          <h3 className="text-lg font-semibold">Documents</h3>
                          <div className="space-y-0.5">
                            {projectNotes.map((doc) => (
                              <button
                                type="button"
                                key={doc.id}
                                className="w-full flex items-center gap-2 py-2 px-2 rounded-md hover:bg-muted/50 text-left text-sm"
                                onClick={() => {
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
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddDocument(newDocumentTitle);
                                  }
                                }}
                                className="flex-1 min-w-0 h-8 text-sm placeholder:opacity-70 border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                              />
                              <Button
                                type="button"
                                variant="outline"
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
                        </div>
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="hidden md:flex w-80 min-w-[320px] flex-col overflow-hidden border-l">
                    <Tabs defaultValue="properties" className="flex-1 flex flex-col min-h-0">
                      <div className="flex-shrink-0 border-b bg-background px-6 pb-4 pt-4">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="properties">
                            <div className="flex items-center gap-2">
                              <Settings className="h-4 w-4" />
                              <span>Properties</span>
                            </div>
                          </TabsTrigger>
                          <TabsTrigger value="documents">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              <span>Documents</span>
                            </div>
                          </TabsTrigger>
                        </TabsList>
                      </div>

                      <div className="flex-1 min-h-0 overflow-hidden">
                        <TabsContent value="properties" className="h-full min-h-0 m-0 data-[state=active]:flex flex-col overflow-hidden">
                          <ScrollArea className="flex-1">
                            <div className="p-6">
                              <ProjectPropertiesFields form={form} />
                            </div>
                          </ScrollArea>
                        </TabsContent>
                        <TabsContent value="documents" className="h-full m-0 overflow-hidden data-[state=active]:flex flex-col">
                          <ScrollArea className="flex-1 min-h-0">
                            <div className="p-2 space-y-0.5">
                              {projectNotes.map((doc) => (
                                <button
                                  type="button"
                                  key={doc.id}
                                  className="w-full flex items-center gap-2 py-2 px-2 rounded-md hover:bg-muted/50 text-left text-sm"
                                  onClick={() => {
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
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddDocument(newDocumentTitle);
                                    }
                                  }}
                                  className="flex-1 min-w-0 h-8 text-sm placeholder:opacity-70 border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
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
                          </ScrollArea>
                        </TabsContent>
                      </div>
                    </Tabs>
                  </div>
                </form>
              </Form>
            )}
          </div>
        </DialogContent>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the project.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleteProject.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteProject.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Dialog>

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
