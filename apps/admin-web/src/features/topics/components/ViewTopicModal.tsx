'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { Separator } from '@altitutor/ui';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';
import { PencilIcon, TrashIcon, Loader2, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@altitutor/ui';
import { useRouter } from 'next/navigation';
import { formatSubjectDisplay } from '@/shared/utils';
import { subjectsApi } from '@/features/subjects/api';
import type { Tables, TablesUpdate } from '@altitutor/shared';
import {
  useTopicById,
  useTopics,
  useUpdateTopic,
  useDeleteTopic,
  useTopicsBySubject,
  useTopicFilesByTopic,
} from '../hooks';
import { useSubjects } from '@/features/subjects/hooks/useSubjectsQuery';
import { TopicsHierarchy, TopicNode } from './TopicsHierarchy';
import { DraggableTopicsList } from './DraggableTopicsList';
import { FilePreview } from './FilePreview';
import { AddTopicModal } from './AddTopicModal';
import { AddResourceFileModal } from './AddResourceFileModal';
import { deriveTopicFileCode, deriveTopicCode, buildTopicTree } from '../utils/codes';
import { Plus } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(1, 'Topic name is required'),
  subject_id: z.string().min(1, 'Subject is required'),
  parent_id: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export interface ViewTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicId: string | null;
  onTopicUpdated?: () => void;
}

export function ViewTopicModal({
  isOpen,
  onClose,
  topicId,
  onTopicUpdated,
}: ViewTopicModalProps) {
  const { toast } = useToast();
  const router = useRouter();
  
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isAddTopicModalOpen, setIsAddTopicModalOpen] = useState(false);
  const [addTopicParentId, setAddTopicParentId] = useState<string | undefined>(undefined);
  const [isAddResourceModalOpen, setIsAddResourceModalOpen] = useState(false);
  const [isViewTopicModalOpen, setIsViewTopicModalOpen] = useState(false);
  const [viewTopicId, setViewTopicId] = useState<string | null>(null);
  
  const { data: topic, isLoading, error } = useTopicById(topicId);
  const { data: subjects = [] } = useSubjects();
  const { data: allTopics = [] } = useTopics();
  const { data: subjectTopics = [] } = useTopicsBySubject(topic?.subject_id || null);
  const { data: topicFiles = [] } = useTopicFilesByTopic(topicId);
  
  const updateTopicMutation = useUpdateTopic();
  const deleteTopicMutation = useDeleteTopic();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      subject_id: '',
      parent_id: 'none',
    },
  });

  // Update form when topic is loaded
  useEffect(() => {
    if (topic) {
      form.reset({
        name: topic.name,
        subject_id: topic.subject_id,
        parent_id: topic.parent_id || 'none',
      });
    }
  }, [topic, form]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (topic) {
      form.reset({
        name: topic.name,
        subject_id: topic.subject_id,
        parent_id: topic.parent_id || 'none',
      });
    }
    setIsEditing(false);
  };

  const onSubmit = async (values: FormData) => {
    if (!topicId) return;

    try {
      const topicData: TablesUpdate<'topics'> = {
        name: values.name,
        subject_id: values.subject_id,
        parent_id: values.parent_id === 'none' ? null : values.parent_id || null,
      };

      await updateTopicMutation.mutateAsync({ id: topicId, data: topicData });

      setIsEditing(false);

      if (onTopicUpdated) {
        onTopicUpdated();
      }
    } catch (error) {
      console.error('Failed to update topic:', error);
    }
  };

  const handleDelete = async () => {
    if (!topicId) return;

    try {
      await deleteTopicMutation.mutateAsync(topicId);

      if (onTopicUpdated) {
        onTopicUpdated();
      }

      setShowDeleteDialog(false);
      onClose();
    } catch (error) {
      console.error('Failed to delete topic:', error);
    }
  };

  // Get children topics
  const childrenTopics = subjectTopics.filter(t => t.parent_id === topicId);
  
  // Get available parent topics (exclude self and descendants)
  const availableParents = subjectTopics.filter(t => 
    t.id !== topicId && t.parent_id !== topicId
  );

  const subject = subjects.find(s => s.id === topic?.subject_id);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="h-full max-h-[100vh] overflow-y-auto w-full sm:max-w-[600px]">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl">
              {isLoading ? 'Topic' : isEditing ? 'Edit Topic' : 'Topic Details'}
            </SheetTitle>
            {!isLoading && topic && (
              <SheetDescription className="text-lg font-medium">
                {topic.name}
              </SheetDescription>
            )}
          </SheetHeader>

          {isLoading ? (
            <div className="py-6 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p>Loading topic data...</p>
            </div>
          ) : error ? (
            <div className="py-6 text-center text-destructive">
              <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
              <p>Failed to load topic</p>
            </div>
          ) : topic ? (
            <div className="space-y-8 pb-20">
              {isEditing ? (
                // Edit Mode
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="name" className="text-right">
                        Name
                      </Label>
                      <Input
                        id="name"
                        {...form.register('name')}
                        className="col-span-3"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="subject_id" className="text-right">
                        Subject
                      </Label>
                      <Select
                        value={form.watch('subject_id')}
                        onValueChange={(value) => form.setValue('subject_id', value)}
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Select subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects.map((subject) => (
                            <SelectItem key={subject.id} value={subject.id}>
                              {formatSubjectDisplay(subject)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="parent_id" className="text-right">
                        Parent
                      </Label>
                      <Select
                        value={form.watch('parent_id')}
                        onValueChange={(value) => form.setValue('parent_id', value)}
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="None (root topic)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None (root topic)</SelectItem>
                          {availableParents.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Child Topics Reordering */}
                  {childrenTopics.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-semibold mb-3">Child Topics</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Drag to reorder
                      </p>
                      <DraggableTopicsList
                        topics={childrenTopics}
                        allTopics={allTopics}
                        onReorder={(updates) => {
                          // Handle reordering - this would call a batch update API
                          console.log('Reorder updates:', updates);
                        }}
                      />
                    </div>
                  )}
                </form>
              ) : (
                // View Mode
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div className="text-sm font-medium">Name:</div>
                    <div>{topic.name}</div>

                    <div className="text-sm font-medium">Subject:</div>
                    <div>
                      {subject ? (
                        <Badge variant="outline">{formatSubjectDisplay(subject)}</Badge>
                      ) : (
                        'N/A'
                      )}
                    </div>

                    <div className="text-sm font-medium">Parent:</div>
                    <div>
                      {topic.parent_id
                        ? allTopics.find(t => t.id === topic.parent_id)?.name || 'Unknown'
                        : 'None (root topic)'}
                    </div>
                  </div>

                  <Separator className="my-4" />

                  {/* Files Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold">Files</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsAddResourceModalOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add File
                      </Button>
                    </div>
                    {topicFiles.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No files attached to this topic</p>
                    ) : (
                      <div className="space-y-3">
                        {topicFiles.map((topicFile) => {
                          const topicCode = topic ? deriveTopicCode(topic, allTopics) : '';
                          const code = `${topicCode}${topicFile.type}.${topicFile.index}${topicFile.is_solutions ? '_SOL' : ''}`;
                          return (
                            <div key={topicFile.id} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{code}</Badge>
                                <span className="text-sm font-medium">{topicFile.type}</span>
                                {topicFile.is_solutions && (
                                  <Badge variant="secondary">Solutions</Badge>
                                )}
                              </div>
                              {topicFile.file && (
                                <FilePreview
                                  fileUrl={topicFile.file.storage_path}
                                  fileName={topicFile.file.filename}
                                  mimeType={topicFile.file.mimetype}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <Separator className="my-4" />

                  {/* Subtopics Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold">Subtopics</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsAddTopicModalOpen(true);
                          setAddTopicParentId(topicId || undefined);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Subtopic
                      </Button>
                    </div>
                    {childrenTopics.length > 0 ? (
                      <div className="space-y-1">
                        {buildTopicTree(subjectTopics, topicId || null).map((childTopic) => (
                          <TopicNode
                            key={childTopic.id}
                            topic={childTopic}
                            allTopics={subjectTopics}
                            level={0}
                            showAddTopic={false}
                            showAddResource={false}
                            onTopicClick={(id) => {
                              setViewTopicId(id);
                              setIsViewTopicModalOpen(true);
                            }}
                            searchQuery=""
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No subtopics</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-6 text-center text-destructive">
              Topic not found or has been deleted.
            </div>
          )}

          {/* Action buttons at the bottom */}
          {!isLoading && topic && (
            <SheetFooter className="absolute bottom-0 left-0 right-0 p-6 border-t bg-background">
              <div className="flex w-full justify-between">
                {isEditing ? (
                  <>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={updateTopicMutation.isPending}
                    >
                      <TrashIcon className="h-4 w-4 mr-2" />
                      Delete
                    </Button>

                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={updateTopicMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        disabled={updateTopicMutation.isPending}
                        onClick={form.handleSubmit(onSubmit)}
                      >
                        {updateTopicMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button variant="outline" onClick={handleEdit} disabled={!topic}>
                    <PencilIcon className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirmation dialog for delete */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the topic and all its
              children.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTopicMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteTopicMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTopicMutation.isPending ? 'Deleting...' : 'Delete Topic'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Topic Modal */}
      <AddTopicModal
        isOpen={isAddTopicModalOpen}
        onClose={() => {
          setIsAddTopicModalOpen(false);
          if (onTopicUpdated) onTopicUpdated();
        }}
        preselectedSubjectId={topic?.subject_id}
        preselectedParentId={addTopicParentId}
        onTopicAdded={() => {
          if (onTopicUpdated) onTopicUpdated();
        }}
      />

      {/* Add Resource Modal */}
      <AddResourceFileModal
        isOpen={isAddResourceModalOpen}
        onClose={() => {
          setIsAddResourceModalOpen(false);
          if (onTopicUpdated) onTopicUpdated();
        }}
        preselectedSubjectId={topic?.subject_id}
        preselectedTopicId={topicId || undefined}
        onResourceAdded={() => {
          if (onTopicUpdated) onTopicUpdated();
        }}
      />

      {/* Nested View Topic Modal for subtopics */}
      {isViewTopicModalOpen && (
        <ViewTopicModal
          isOpen={isViewTopicModalOpen}
          onClose={() => setIsViewTopicModalOpen(false)}
          topicId={viewTopicId}
          onTopicUpdated={() => {
            if (onTopicUpdated) onTopicUpdated();
          }}
        />
      )}
    </>
  );
}
