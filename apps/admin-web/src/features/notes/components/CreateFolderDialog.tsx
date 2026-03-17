'use client';

import { useState, useCallback, useEffect } from 'react';
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
import { useCreateFolder } from '../hooks/useNoteMutations';
import { useFolders } from '../api/queries';
import { SearchableSelect } from '@altitutor/ui';
import { useDialogHotkeys } from '@/shared/hooks';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';
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
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      parentId: defaultParentId ?? null,
    },
  });

  const onSubmit = useCallback(async (data: FormData) => {
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
  }, [createFolder, form, onClose]);

  const handlePrimaryAction = useCallback(() => {
    if (isSubmitting) return;
    void form.handleSubmit(onSubmit)();
  }, [form, isSubmitting, onSubmit]);

  useDialogHotkeys({
    isOpen,
    onPrimaryAction: handlePrimaryAction,
    isActionDisabled: isSubmitting,
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle>Create Folder</DialogTitle>
              <DialogDescription>Create a new folder to organize your notes.</DialogDescription>
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
            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => {
                const rootOption = { id: '__none__', name: 'None (Root)' } as const;
                const folderItems = [rootOption, ...(folders ?? []).map((f) => ({ id: f.id, name: f.name }))];
                const selected =
                  !field.value || field.value === '__none__'
                    ? rootOption
                    : folderItems.find((f) => f.id === field.value) ?? rootOption;
                return (
                  <FormItem>
                    <FormLabel>Parent Folder (optional)</FormLabel>
                    <FormControl>
                      <SearchableSelect<{ id: string; name: string }>
                        items={folderItems}
                        value={selected}
                        onValueChange={(item) =>
                          field.onChange(item?.id === '__none__' ? null : item?.id ?? null)
                        }
                        getItemLabel={(f) => f.name}
                        getItemId={(f) => f.id}
                        placeholder="Select a parent folder"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
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
