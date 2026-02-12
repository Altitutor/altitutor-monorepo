'use client';

import { useEffect } from 'react';
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
import { useUpdateNote } from '../hooks/useNoteMutations';
import type { Note } from '../types';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
});

type FormData = z.infer<typeof formSchema>;

interface RenameNoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note;
}

export function RenameNoteDialog({
  isOpen,
  onClose,
  note,
}: RenameNoteDialogProps) {
  const updateNote = useUpdateNote();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: note.title,
    },
  });

  // Reset form when note changes
  useEffect(() => {
    if (isOpen) {
      form.reset({
        title: note.title,
      });
    }
  }, [isOpen, note.title, form]);

  const onSubmit = async (data: FormData) => {
    try {
      await updateNote.mutateAsync({
        id: note.id,
        updates: { title: data.title },
        silent: false,
      });
      onClose();
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Note</DialogTitle>
          <DialogDescription>Change the title of this note.</DialogDescription>
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateNote.isPending}>
                {updateNote.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
