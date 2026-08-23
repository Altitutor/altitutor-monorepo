'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  type RichTextEditorRef,
} from '@altitutor/ui';
import { MoreVertical } from 'lucide-react';
import { RichTextTemplateMenuItems } from '@/features/rich-text-templates/components/RichTextTemplateMenuItems';
import { SaveAsTemplateDialog } from '@/features/rich-text-templates/components/SaveAsTemplateDialog';
import { useCreateProject } from '../api/mutations';
import type { ProjectFormData, ProjectPriority, ProjectStatus } from '../types';
import type { SubmitHandler } from 'react-hook-form';
import { ProjectTitleField } from './fields/ProjectTitleField';
import { ProjectDescriptionField } from './fields/ProjectDescriptionField';
import { ProjectPropertiesFields } from './fields/ProjectPropertiesFields';
import { useCurrentStaff, useDialogHotkeys } from '@/shared/hooks';
import { AdminDialogShell } from '@/shared/components';
import { EntityResizablePanels } from '@/shared/components/EntityResizablePanels';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.union([z.record(z.unknown()), z.string(), z.null()]).optional(),
  status: z.enum(['backlog', 'planned', 'in_progress', 'completed']),
  priority: z.number().min(0).max(4),
  projectLeadId: z.union([z.string().uuid(), z.null()]).default(null),
  startDate: z.union([z.string(), z.null()]).default(null),
  targetDate: z.union([z.string(), z.null()]).default(null),
});

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated?: (projectId: string) => void;
  initialStatus?: ProjectStatus;
  initialPriority?: ProjectPriority | null;
  initialProjectLeadId?: string | null;
}

export function CreateProjectDialog({
  isOpen,
  onClose,
  onProjectCreated,
  initialStatus = 'backlog',
  initialPriority = null,
  initialProjectLeadId = null,
}: CreateProjectDialogProps) {
  const createProject = useCreateProject();
  const { data: currentStaff } = useCurrentStaff();
  const titleFieldRef = useRef<HTMLInputElement>(null);
  const descriptionFieldRef = useRef<RichTextEditorRef>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);

  const form = useForm<ProjectFormData, unknown, ProjectFormData>({
    resolver: zodResolver(formSchema) as Resolver<ProjectFormData>,
    defaultValues: {
      name: '',
      description: null,
      status: initialStatus,
      priority: (initialPriority ?? 0) as ProjectPriority,
      projectLeadId: initialProjectLeadId ?? null,
      startDate: null,
      targetDate: null,
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    form.reset({
      name: '',
      description: null,
      status: initialStatus,
      priority: (initialPriority ?? 0) as ProjectPriority,
      projectLeadId: initialProjectLeadId ?? null,
      startDate: null,
      targetDate: null,
    });
  }, [isOpen, initialStatus, initialPriority, initialProjectLeadId, form]);

  const handleClose = useCallback(() => {
    form.reset();
    onClose();
  }, [form, onClose]);

  const onSubmit = useCallback(async (data: ProjectFormData) => {
    try {
      const created = await createProject.mutateAsync({
        name: data.name,
        description: data.description || null,
        status: data.status,
        priority: data.priority,
        project_lead_id: data.projectLeadId || null,
        start_date: data.startDate ? new Date(data.startDate).toISOString() : null,
        target_date: data.targetDate ? new Date(data.targetDate).toISOString() : null,
        created_by: currentStaff?.id ?? null,
      });
      onProjectCreated?.(created.id);
      handleClose();
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  }, [createProject, currentStaff, handleClose, onProjectCreated]);

  const handleTitleEnter = useCallback(() => {
    const editor = descriptionFieldRef.current?.getEditor();
    if (editor && editor.commands && typeof editor.commands.focus === 'function') {
      editor.commands.focus();
    }
  }, []);

  const handlePrimaryAction = useCallback(() => {
    if (createProject.isPending) return;
    void form.handleSubmit(onSubmit as SubmitHandler<ProjectFormData>)();
  }, [createProject.isPending, form, onSubmit]);

  useDialogHotkeys({
    isOpen,
    onPrimaryAction: handlePrimaryAction,
    isActionDisabled: createProject.isPending,
  });

  return (
    <>
      <AdminDialogShell
        fillHeight
        defaultExpanded
        open={isOpen}
        onClose={handleClose}
        title="Create Project"
        contentClassName="md:max-w-4xl"
        bodyClassName="min-h-0 flex-1 overflow-hidden p-0"
        headerActions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <RichTextTemplateMenuItems
                getEditor={() => descriptionFieldRef.current?.getEditor() ?? null}
                getCurrentContent={() => form.getValues('description') ?? null}
                onSaveAsTemplateClick={() => setIsSaveDialogOpen(true)}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        }
        footer={
          <>
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" form="create-project-form" disabled={createProject.isPending}>
              {createProject.isPending ? 'Creating...' : 'Create Project'}
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form
            id="create-project-form"
            onSubmit={form.handleSubmit(onSubmit as SubmitHandler<ProjectFormData>)}
            className="flex h-full min-h-0 flex-1"
          >
            <EntityResizablePanels
              id="create-project-panels"
              main={(
                <div
                  className="h-full min-w-0 overflow-y-auto p-6 space-y-6"
                  data-rich-text-toolbar-container
                >
                  <ProjectTitleField
                    form={form}
                    onEnter={handleTitleEnter}
                    titleRef={titleFieldRef}
                  />
                  <ProjectDescriptionField
                    form={form}
                    descriptionRef={descriptionFieldRef}
                  />
                </div>
              )}
              sidebar={(
                <div className="hidden h-full w-full overflow-y-auto p-6 md:block">
                  <ProjectPropertiesFields form={form} />
                </div>
              )}
            />
          </form>
        </Form>
      </AdminDialogShell>
      <SaveAsTemplateDialog
        isOpen={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        initialContent={form.getValues('description') ?? null}
        onSuccess={() => setIsSaveDialogOpen(false)}
      />
    </>
  );
}
