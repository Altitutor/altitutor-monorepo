'use client';

import { UseFormReturn } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem } from '@altitutor/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';
import { useProjects } from '@/features/projects/api/queries';

import type { NoteFormData } from '../types';

interface NotePropertiesPanelProps {
  form: UseFormReturn<NoteFormData>;
  folders?: Array<{ id: string; name: string }>;
}

export function NotePropertiesPanel({ form, folders }: NotePropertiesPanelProps) {
  const { data: projects = [] } = useProjects();

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-foreground">Properties</h3>
      <Form {...form}>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Folder</label>
            <FormField
              control={form.control}
              name="folder_id"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Select
                      value={field.value || '__none__'}
                      onValueChange={(value) => field.onChange(value === '__none__' ? null : value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No folder" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {folders?.map((folder) => (
                          <SelectItem key={folder.id} value={folder.id}>
                            {folder.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Project</label>
            <FormField
              control={form.control}
              name="project_id"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Select
                      value={field.value || '__none__'}
                      onValueChange={(value) => field.onChange(value === '__none__' ? null : value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>
      </Form>
    </div>
  );
}
