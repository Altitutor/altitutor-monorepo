'use client';

import { UseFormReturn } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, Button } from '@altitutor/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';
import { Trash2 } from 'lucide-react';
import { z } from 'zod';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string(),
  folder_id: z.string().nullable().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface NotePropertiesPanelProps {
  form: UseFormReturn<FormData>;
  folders?: Array<{ id: string; name: string }>;
  onDelete?: () => void;
}

export function NotePropertiesPanel({ form, folders, onDelete }: NotePropertiesPanelProps) {
  return (
    <div className="bg-card rounded-lg p-6 space-y-6 flex flex-col border">
      <h3 className="text-sm font-semibold text-foreground">Properties</h3>
      <Form {...form}>
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
      </Form>

      {/* Delete button at bottom */}
      {onDelete && (
        <div className="mt-auto pt-6">
          <Button
            variant="destructive"
            onClick={onDelete}
            className="w-full"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Note
          </Button>
        </div>
      )}
    </div>
  );
}
