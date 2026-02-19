'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { useCreateNote } from '../hooks/useNoteMutations';
import { useFolders } from '../api/queries';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  folderId: z.string().nullable().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CreateNoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultFolderId?: string | null;
}

export function CreateNoteDialog({
  isOpen,
  onClose,
  defaultFolderId,
}: CreateNoteDialogProps) {
  const router = useRouter();
  const createNote = useCreateNote();
  const { data: folders } = useFolders();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      folderId: defaultFolderId ?? null,
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const createdNote = await createNote.mutateAsync({
        title: data.title,
        content: '',
        folder_id: data.folderId || null,
      });
      form.reset();
      onClose();
      // Navigate to the created note's page
      router.push(`/notes/${createdNote.id}`);
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
          <DialogTitle>Create Note</DialogTitle>
          <DialogDescription>Create a new note to start writing.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Note title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="folderId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Folder (optional)</FormLabel>
                  <Select
                    value={field.value || '__none__'}
                    onValueChange={(value) => field.onChange(value === '__none__' ? null : value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a folder" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
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
