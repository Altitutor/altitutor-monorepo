'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  SearchableSelect,
} from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateTopic, useTopicsBySubject } from '../hooks';
import { useSubjects } from '@/features/subjects/hooks/useSubjectsQuery';
import type { Tables } from '@altitutor/shared';

const formSchema = z.object({
  name: z.string().min(1, 'Topic name is required'),
  subject_id: z.string().min(1, 'Subject is required'),
  parent_id: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export interface AddTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedSubjectId?: string;
  preselectedParentId?: string;
  onTopicAdded?: (topic: Tables<'topics'>) => void;
}

export function AddTopicModal({
  isOpen,
  onClose,
  preselectedSubjectId,
  preselectedParentId,
  onTopicAdded,
}: AddTopicModalProps) {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
    preselectedSubjectId || null
  );

  const { data: subjects = [], isLoading: subjectsLoading } = useSubjects();
  const { data: topics = [] } = useTopicsBySubject(selectedSubjectId);
  const createTopicMutation = useCreateTopic();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      subject_id: preselectedSubjectId || '',
      parent_id: preselectedParentId || 'none',
    },
  });

  // Update form when preselected values change
  useEffect(() => {
    if (preselectedSubjectId) {
      form.setValue('subject_id', preselectedSubjectId);
      setSelectedSubjectId(preselectedSubjectId);
    }
    if (preselectedParentId) {
      form.setValue('parent_id', preselectedParentId);
    }
  }, [preselectedSubjectId, preselectedParentId, form]);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      form.reset({
        name: '',
        subject_id: preselectedSubjectId || '',
        parent_id: preselectedParentId || 'none',
      });
      setSelectedSubjectId(preselectedSubjectId || null);
    }
  }, [isOpen, preselectedSubjectId, preselectedParentId, form]);

  const onSubmit = async (values: FormData) => {
    try {
      const topic = await createTopicMutation.mutateAsync({
        name: values.name,
        subject_id: values.subject_id,
        parent_id: values.parent_id === 'none' ? null : values.parent_id || null,
      });

      if (onTopicAdded) {
        onTopicAdded(topic);
      }

      onClose();
    } catch (error) {
      // Error is handled by the mutation
      console.error('Failed to create topic:', error);
    }
  };

  const handleSubjectChange = (s: Tables<'subjects'> | null) => {
    const value = s?.id ?? '';
    setSelectedSubjectId(value || null);
    form.setValue('subject_id', value);
    // Clear parent selection when subject changes
    form.setValue('parent_id', 'none');
  };

  // Filter topics to only show those in the selected subject
  const availableParentTopics = topics.filter((t) => t.subject_id === selectedSubjectId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Topic</DialogTitle>
          <DialogDescription>
            Create a new topic. Index will be automatically assigned.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject_id">Subject *</Label>
            <SearchableSelect<Tables<'subjects'>>
              items={subjects}
              value={subjects.find((s) => s.id === form.watch('subject_id')) ?? null}
              onValueChange={handleSubjectChange}
              getItemId={(item) => item.id}
              getItemLabel={(item) => item?.long_name ?? item.name ?? ''}
              placeholder="Select subject"
              disabled={!!preselectedSubjectId || subjectsLoading}
              trigger={
                <Button variant="outline" className="w-full justify-start font-normal" id="subject_id">
                  {subjects.find((s) => s.id === form.watch('subject_id'))?.long_name ?? 'Select subject'}
                </Button>
              }
            />
            {form.formState.errors.subject_id && (
              <p className="text-sm text-destructive">{form.formState.errors.subject_id.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="parent_id">Parent Topic (Optional)</Label>
            <SearchableSelect<{ id: string; label: string }>
              items={[
                { id: 'none', label: 'None (root topic)' },
                ...availableParentTopics.map((t) => ({ id: t.id, label: t.name })),
              ]}
              value={
                form.watch('parent_id') === 'none' || !form.watch('parent_id')
                  ? { id: 'none', label: 'None (root topic)' }
                  : availableParentTopics.find((t) => t.id === form.watch('parent_id'))
                    ? { id: form.watch('parent_id')!, label: availableParentTopics.find((t) => t.id === form.watch('parent_id'))!.name }
                    : null
              }
              onValueChange={(v) => form.setValue('parent_id', v?.id ?? 'none')}
              getItemId={(item) => item.id}
              getItemLabel={(item) => item.label}
              placeholder="None (root topic)"
              disabled={!selectedSubjectId || !!preselectedParentId}
              trigger={
                <Button variant="outline" className="w-full justify-start font-normal" id="parent_id">
                  {form.watch('parent_id') === 'none' || !form.watch('parent_id')
                    ? 'None (root topic)'
                    : availableParentTopics.find((t) => t.id === form.watch('parent_id'))?.name ?? 'None (root topic)'}
                </Button>
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Topic Name *</Label>
            <Input
              id="name"
              {...form.register('name')}
              placeholder="Enter topic name"
              disabled={createTopicMutation.isPending}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={createTopicMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createTopicMutation.isPending}>
              {createTopicMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add Topic
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
