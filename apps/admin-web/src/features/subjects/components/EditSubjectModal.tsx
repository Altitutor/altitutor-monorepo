'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@altitutor/ui';
import { useRouter } from 'next/navigation';
import { subjectsApi } from '../api';
import type { Tables, TablesUpdate } from '@altitutor/shared';
import { DraggableTopicsList } from '@/features/topics/components';
import { useTopics, useRootTopics, useUpdateTopicIndices } from '@/features/topics/hooks';

const formSchema = z.object({
  name: z.string().min(1, 'Subject name is required'),
  year_level: z.coerce.number().int().min(1).max(12).nullable(),
  curriculum: z.enum(['SACE', 'IB', 'PRESACE', 'PRIMARY', 'MEDICINE']).nullable(),
  discipline: z.enum(['MATHEMATICS', 'SCIENCE', 'HUMANITIES', 'ENGLISH', 'ART', 'LANGUAGE', 'MEDICINE']).nullable(),
  level: z.string().nullable(),
});

type FormData = z.infer<typeof formSchema>;

export interface EditSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectId: string | null;
  onSubjectUpdated?: () => void;
}

export function EditSubjectModal({
  isOpen,
  onClose,
  subjectId,
  onSubjectUpdated,
}: EditSubjectModalProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [subject, setSubject] = useState<Tables<'subjects'> | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: allTopics = [] } = useTopics();
  const { data: rootTopics = [] } = useRootTopics(subjectId);
  const updateIndicesMutation = useUpdateTopicIndices();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      year_level: null,
      curriculum: null,
      discipline: null,
      level: null,
    },
  });

  useEffect(() => {
    if (isOpen && subjectId) {
      loadSubject(subjectId);
    } else {
      setSubject(null);
      setError(null);
    }
  }, [isOpen, subjectId]);

  useEffect(() => {
    if (subject) {
      form.reset({
        name: subject.name,
        year_level: subject.year_level,
        curriculum: subject.curriculum as any,
        discipline: subject.discipline as any,
        level: subject.level,
      });
    }
  }, [subject, form]);

  const loadSubject = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await subjectsApi.getSubject(id);
      if (data) {
        setSubject(data);
      } else {
        setError('Subject not found.');
      }
    } catch (err) {
      console.error('Failed to load subject:', err);
      setError('Failed to load subject details.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: FormData) => {
    if (!subject) return;

    try {
      setSubmitting(true);
      const updatedData: TablesUpdate<'subjects'> = {
        name: values.name,
        year_level: values.year_level,
        curriculum: values.curriculum as any,
        discipline: values.discipline as any,
        level: values.level,
      };

      const updated = await subjectsApi.updateSubject(subject.id, updatedData);

      setSubject(updated);

      toast({
        title: 'Subject updated',
        description: `${updated.name} has been updated successfully.`,
      });

      if (onSubjectUpdated) {
        onSubjectUpdated();
      }

      router.refresh();
      onClose();
    } catch (err) {
      console.error('Failed to update subject:', err);
      toast({
        title: 'Update failed',
        description: 'There was an error updating the subject. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTopicsReorder = async (updates: Array<{ id: string; index: number }>) => {
    try {
      await updateIndicesMutation.mutateAsync(updates);
    } catch (error) {
      console.error('Failed to reorder topics:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Subject</DialogTitle>
          <DialogDescription>
            Update subject details and reorder root-level topics.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading subject details...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-8 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold">Error Loading Subject</h3>
            <p className="text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => subjectId && loadSubject(subjectId)}
            >
              Try Again
            </Button>
          </div>
        ) : subject ? (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Subject Name *</Label>
                <Input id="name" {...form.register('name')} placeholder="Enter subject name" />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="year_level">Year Level</Label>
                  <Input
                    id="year_level"
                    type="number"
                    {...form.register('year_level', { valueAsNumber: true })}
                    placeholder="1-12"
                    min="1"
                    max="12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="level">Level</Label>
                  <Input
                    id="level"
                    {...form.register('level')}
                    placeholder="e.g. HL, SL"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="curriculum">Curriculum</Label>
                  <Select
                    value={form.watch('curriculum') || ''}
                    onValueChange={(value) => form.setValue('curriculum', value as any)}
                  >
                    <SelectTrigger id="curriculum">
                      <SelectValue placeholder="Select curriculum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      <SelectItem value="SACE">SACE</SelectItem>
                      <SelectItem value="IB">IB</SelectItem>
                      <SelectItem value="PRESACE">PRESACE</SelectItem>
                      <SelectItem value="PRIMARY">PRIMARY</SelectItem>
                      <SelectItem value="MEDICINE">MEDICINE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discipline">Discipline</Label>
                  <Select
                    value={form.watch('discipline') || ''}
                    onValueChange={(value) => form.setValue('discipline', value as any)}
                  >
                    <SelectTrigger id="discipline">
                      <SelectValue placeholder="Select discipline" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      <SelectItem value="MATHEMATICS">MATHEMATICS</SelectItem>
                      <SelectItem value="SCIENCE">SCIENCE</SelectItem>
                      <SelectItem value="HUMANITIES">HUMANITIES</SelectItem>
                      <SelectItem value="ENGLISH">ENGLISH</SelectItem>
                      <SelectItem value="ART">ART</SelectItem>
                      <SelectItem value="LANGUAGE">LANGUAGE</SelectItem>
                      <SelectItem value="MEDICINE">MEDICINE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Root Topics Section */}
            {rootTopics.length > 0 && (
              <div className="space-y-3">
                <div>
                  <Label>Root Topics</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Drag to reorder. Changes save automatically.
                  </p>
                </div>
                <DraggableTopicsList
                  topics={rootTopics}
                  allTopics={allTopics}
                  onReorder={handleTopicsReorder}
                />
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

