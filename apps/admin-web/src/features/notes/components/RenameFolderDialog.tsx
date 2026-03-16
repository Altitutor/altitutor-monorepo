'use client';

import { useEffect, useState } from 'react';
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
import { useUpdateFolder } from '../hooks/useNoteMutations';
import type { FolderTreeItem } from '../types';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';

const formSchema = z.object({
  name: z.string().min(1, 'Folder name is required'),
});

type FormData = z.infer<typeof formSchema>;

interface RenameFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  folder: FolderTreeItem;
}

export function RenameFolderDialog({
  isOpen,
  onClose,
  folder,
}: RenameFolderDialogProps) {
  const updateFolder = useUpdateFolder();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: folder.name,
    },
  });

  // Reset form when folder changes
  useEffect(() => {
    if (isOpen) {
      form.reset({
        name: folder.name,
      });
    }
  }, [isOpen, folder.name, form]);

  const onSubmit = async (data: FormData) => {
    try {
      await updateFolder.mutateAsync({
        id: folder.id,
        updates: { name: data.name },
      });
      onClose();
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle>Rename Folder</DialogTitle>
              <DialogDescription>Change the name of this folder.</DialogDescription>
            </div>
            <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
          </div>
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateFolder.isPending}>
                {updateFolder.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
