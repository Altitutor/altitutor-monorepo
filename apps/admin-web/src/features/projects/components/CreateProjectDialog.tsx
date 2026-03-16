'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Form,
  Button,
  type RichTextEditorRef,
} from '@altitutor/ui';
import { X } from 'lucide-react';
import { useCreateProject } from '../api/mutations';
import type { ProjectFormData, ProjectPriority, ProjectStatus } from '../types';
import type { SubmitHandler } from 'react-hook-form';
import { ProjectTitleField } from './fields/ProjectTitleField';
import { ProjectDescriptionField } from './fields/ProjectDescriptionField';
import { ProjectPropertiesFields } from './fields/ProjectPropertiesFields';
import { useCurrentStaff, useDialogHotkeys } from '@/shared/hooks';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';

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
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className={cn(
          'w-full md:max-w-4xl h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <Form {...form}>
          <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
            <div className="flex items-center justify-between gap-4 w-full">
              <div className="flex items-center gap-3 flex-1">
                <Button variant="outline" size="icon" onClick={handleClose} className="shrink-0">
                  <X className="h-4 w-4" />
                </Button>
                <DialogTitle>Create Project</DialogTitle>
              </div>
              <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden min-h-0">
            <div className="h-full flex">
              <form onSubmit={form.handleSubmit(onSubmit as SubmitHandler<ProjectFormData>)} className="flex-1 flex min-h-0">
                <div className="flex-1 min-w-0 border-r overflow-y-auto p-6 space-y-6">
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
                <div className="w-80 flex-shrink-0 overflow-y-auto p-6">
                  <ProjectPropertiesFields form={form} />
                </div>
              </form>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 px-6 py-4 border-t">
            <div className="flex items-center gap-2 w-full justify-end">
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit" onClick={form.handleSubmit(onSubmit as SubmitHandler<ProjectFormData>)} disabled={createProject.isPending}>
                {createProject.isPending ? 'Creating...' : 'Create Project'}
              </Button>
            </div>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
