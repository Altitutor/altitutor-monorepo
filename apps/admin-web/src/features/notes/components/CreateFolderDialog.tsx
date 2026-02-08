'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { useCreateFolder } from '../api/mutations';
import { useFolders } from '../api/queries';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';

const formSchema = z.object({
  name: z.string().min(1, 'Folder name is required'),
  parentId: z.string().nullable().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CreateFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultParentId?: string | null;
}

export function CreateFolderDialog({
  isOpen,
  onClose,
  defaultParentId,
}: CreateFolderDialogProps) {
  const createFolder = useCreateFolder();
  const { data: folders } = useFolders();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      parentId: defaultParentId ?? null,
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      await createFolder.mutateAsync({
        name: data.name,
        parent_id: data.parentId || null,
      });
      form.reset();
      onClose();
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Folder</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Folder Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Folder name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent Folder (optional)</FormLabel>
                  <Select
                    value={field.value || undefined}
                    onValueChange={(value) => field.onChange(value || null)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a parent folder" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">None (Root)</SelectItem>
                      {folders?.map((folder) => (
                        <SelectItem key={folder.id} value={folder.id}>
                          {folder.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
