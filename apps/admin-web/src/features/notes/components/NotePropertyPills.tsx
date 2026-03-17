'use client';

import { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem } from '@altitutor/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@altitutor/ui';
import { Folder } from 'lucide-react';

import type { NoteFormData } from '../types';
import { ProjectSearchSelect } from './ProjectSearchSelect';

interface NotePropertyPillsProps {
  form: UseFormReturn<NoteFormData>;
  folders?: Array<{ id: string; name: string }>;
}

export function NotePropertyPills({ form, folders }: NotePropertyPillsProps) {
  return (
    <div className="flex flex-wrap gap-2 pb-2">
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
                <SelectTrigger className="h-8 px-3 text-xs border rounded-full">
                  <div className="flex items-center gap-1.5">
                    <Folder className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground shrink-0">Folder</span>
                    <span className="truncate">
                      {field.value ? folders?.find(f => f.id === field.value)?.name || 'Folder' : 'No folder'}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No Folder</SelectItem>
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
      <ProjectSearchSelect form={form} variant="pill" />
    </div>
  );
}
