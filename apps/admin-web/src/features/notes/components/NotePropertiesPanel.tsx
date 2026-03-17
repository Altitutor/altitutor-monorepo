'use client';

import { UseFormReturn } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem } from '@altitutor/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@altitutor/ui';
import { Folder } from 'lucide-react';

import type { NoteFormData } from '../types';
import { ProjectSearchSelect } from './ProjectSearchSelect';

interface NotePropertiesPanelProps {
  form: UseFormReturn<NoteFormData>;
  folders?: Array<{ id: string; name: string }>;
}

export function NotePropertiesPanel({ form, folders }: NotePropertiesPanelProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-foreground">Properties</h3>
      <Form {...form}>
        <div className="space-y-4">
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
                      <div className="flex items-center gap-2 w-full min-w-0">
                        <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-muted-foreground shrink-0">Folder</span>
                        <span className="truncate">
                          {field.value ? folders?.find((f) => f.id === field.value)?.name || 'Folder' : 'No folder'}
                        </span>
                      </div>
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
          <ProjectSearchSelect form={form} />
        </div>
      </Form>
    </div>
  );
}
