'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Badge, Separator } from '@altitutor/ui';
import { Input, Label } from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
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
import { PencilIcon, TrashIcon, Loader2, AlertTriangle, ArrowLeft, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@altitutor/ui';
import { formatSubjectDisplay, getSubjectColorStyle } from '@/shared/utils';
import type { TablesUpdate } from '@altitutor/shared';
import {
  useTopicById,
  useTopics,
  useUpdateTopic,
  useDeleteTopic,
  useTopicsBySubject,
  useTopicFilesByTopic,
  useUpdateTopicIndices,
} from '@/features/topics/hooks';
import { useSubjects } from '@/features/subjects/hooks/useSubjectsQuery';
import { TopicNode } from '@/features/topics/components/TopicsHierarchy';
import { DraggableTopicsList } from '@/features/topics/components/DraggableTopicsList';
import { FileCard } from '@/shared/components/files/FileCard';
import { AddTopicModal } from '@/features/topics/components/AddTopicModal';
import { AddResourceFileModal } from '@/features/topics/components/AddResourceFileModal';
import { EditTopicFileModal } from '@/features/topics/components/EditTopicFileModal';
import { buildTopicTree } from '@/features/topics/utils/codes';
import { ViewTopicModal } from '@/features/topics/components/ViewTopicModal';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { useTopicActions } from '@/features/topics/hooks/useTopicActions';

const formSchema = z.object({
  name: z.string().min(1, 'Topic name is required'),
  subject_id: z.string().min(1, 'Subject is required'),
  parent_id: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function TopicDetailPage({ params }: { params: { id: string; topicId: string } }) {
  const { id: subjectId, topicId } = params;
  const router = useRouter();
  
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isAddTopicModalOpen, setIsAddTopicModalOpen] = useState(false);
  const [addTopicParentId, setAddTopicParentId] = useState<string | undefined>(undefined);
  const [isAddResourceModalOpen, setIsAddResourceModalOpen] = useState(false);
  const [isViewTopicModalOpen, setIsViewTopicModalOpen] = useState(false);
  const [viewTopicId] = useState<string | null>(null);
  const [isEditFileModalOpen, setIsEditFileModalOpen] = useState(false);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [reorderedChildren, setReorderedChildren] = useState<Array<{ id: string; index: number }>>([]);
  
  const { data: topic, isLoading, error } = useTopicById(topicId);
  const { data: subjects = [] } = useSubjects();
  const { data: allTopics = [] } = useTopics();
  const { data: subjectTopics = [] } = useTopicsBySubject(topic?.subject_id || null);
  const { data: topicFiles = [] } = useTopicFilesByTopic(topicId);
  
  const updateTopicMutation = useUpdateTopic();
  const deleteTopicMutation = useDeleteTopic();
  const updateTopicIndices = useUpdateTopicIndices();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      subject_id: '',
      parent_id: 'none',
    },
  });

  useEffect(() => {
    if (topic) {
      form.reset({
        name: topic.name,
        subject_id: topic.subject_id,
        parent_id: topic.parent_id || 'none',
      });
      // Redirect if topic belongs to different subject
      if (subjectId && topic.subject_id !== subjectId) {
        router.replace(`/subjects/${topic.subject_id}/topics/${topicId}`);
      }
    }
  }, [topic, form, subjectId, topicId, router]);

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
    setReorderedChildren([]);
    setIsEditing(false);
  };

  const handleTopicReorder = (updates: Array<{ id: string; index: number }>) => {
    setReorderedChildren(updates);
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
      
      if (reorderedChildren.length > 0) {
        await updateTopicIndices.mutateAsync(reorderedChildren);
        setReorderedChildren([]);
      }
      
      setIsEditing(false);
      
      toast({
        title: 'Topic updated',
        description: 'Topic has been updated successfully.',
      });
      
      // Redirect if subject changed
      if (values.subject_id !== subjectId) {
        router.push(`/subjects/${values.subject_id}/topics/${topicId}`);
      }
    } catch (error) {
      console.error('Failed to update topic:', error);
      toast({
        title: 'Update failed',
        description: 'There was an error updating the topic. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!topicId || !subjectId) return;

    try {
      await deleteTopicMutation.mutateAsync(topicId);
      
      toast({
        title: 'Topic deleted',
        description: 'Topic has been deleted successfully.',
      });
      
      setShowDeleteDialog(false);
      router.push(`/subjects/${subjectId}/topics`);
    } catch (error) {
      console.error('Failed to delete topic:', error);
      toast({
        title: 'Delete failed',
        description: 'There was an error deleting the topic. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Get children topics
  const childrenTopics = subjectTopics.filter(t => t.parent_id === topicId);
  
  // Get available parent topics (exclude self and descendants)
  const availableParents = subjectTopics.filter(t => 
    t.id !== topicId && t.parent_id !== topicId
  );

  const subject = subjects.find(s => s.id === topic?.subject_id);
  // Use subjectId from path, or fallback to topic's subject_id
  const effectiveSubjectId = subjectId || topic?.subject_id || '';

  // Centralized action handlers
  const topicActions = useTopicActions({
    topicId,
    topic,
    onEdit: handleEdit,
    onDelete: () => setShowDeleteDialog(true),
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !topic) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(effectiveSubjectId ? `/subjects/${effectiveSubjectId}/topics` : '/subjects')}
            className="border"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            {error ? 'Error Loading Topic' : 'Topic Not Found'}
          </h1>
        </div>
        {error && (
          <div className="py-6 text-center text-destructive">
            <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
            <p>Failed to load topic</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(effectiveSubjectId ? `/subjects/${effectiveSubjectId}/topics` : '/subjects')}
          className="border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditing ? 'Edit Topic' : 'Topic Details'}
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            {topic.name}
          </p>
        </div>
        {topic && !isEditing && (
          <ActionsMenu
            type="topic"
            entityId={topic.id}
            {...topicActions}
          />
        )}
      </div>

      <div className="space-y-6">
        {isEditing ? (
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
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {formatSubjectDisplay(s)}
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
                  onReorder={handleTopicReorder}
                />
              </div>
            )}

            <div className="flex justify-between gap-2 pt-4 border-t">
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
                  type="submit" 
                  disabled={updateTopicMutation.isPending}
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
            </div>
          </form>
        ) : (
          <>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="text-sm font-medium">Name:</div>
                <div>{topic.name}</div>
                
                <div className="text-sm font-medium">Subject:</div>
                <div>
                  {subject ? (() => {
                    const { style, textColorClass } = getSubjectColorStyle(subject);
                    const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
                    return (
                      <Badge 
                        className={defaultClass || textColorClass}
                        style={style.backgroundColor ? style : undefined}
                      >
                        {formatSubjectDisplay(subject)}
                      </Badge>
                    );
                  })() : (
                    'N/A'
                  )}
                </div>
                
                <div className="text-sm font-medium">Parent:</div>
                <div>
                  {topic.parent_id ? (
                    <button
                      onClick={() => {
                        const parentTopic = allTopics.find(t => t.id === topic.parent_id);
                        if (parentTopic) {
                          router.push(`/subjects/${subjectId}/topics/${parentTopic.id}`);
                        }
                      }}
                      className="text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                    >
                      {allTopics.find(t => t.id === topic.parent_id)?.name || 'Unknown'}
                    </button>
                  ) : (
                    'None (root topic)'
                  )}
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
                  <div className="space-y-2">
                    {topicFiles.map((topicFile) => {
                      const code = topicFile.code || '';
                      
                      return (
                        <FileCard
                          key={topicFile.id}
                          fileCode={code}
                          fileType={topicFile.type}
                          filename={topicFile.file.filename}
                          storagePath={topicFile.file.storage_path}
                          mimeType={topicFile.file.mimetype}
                          topicFileId={topicFile.id}
                          onEdit={(fileId) => {
                            setEditingFileId(fileId);
                            setIsEditFileModalOpen(true);
                          }}
                        />
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
                      setAddTopicParentId(topicId);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Subtopic
                  </Button>
                </div>
                
                {childrenTopics.length > 0 ? (
                  <div className="space-y-1">
                    {buildTopicTree(subjectTopics, topicId).map((childTopic) => (
                      <TopicNode
                        key={childTopic.id}
                        topic={childTopic}
                        allTopics={subjectTopics}
                        level={0}
                        showAddTopic={false}
                        showAddResource={false}
                        onTopicClick={(id) => {
                          router.push(`/subjects/${subjectId}/topics/${id}`);
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

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handleEdit} disabled={!topic}>
                <PencilIcon className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </>
        )}
      </div>

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
        }}
        preselectedSubjectId={topic?.subject_id}
        preselectedParentId={addTopicParentId}
        onTopicAdded={() => {}}
      />

      {/* Add Resource Modal */}
      <AddResourceFileModal
        isOpen={isAddResourceModalOpen}
        onClose={() => {
          setIsAddResourceModalOpen(false);
        }}
        preselectedSubjectId={topic?.subject_id}
        preselectedTopicId={topicId}
        onResourceAdded={() => {}}
      />

      {/* Edit File Modal */}
      {editingFileId && topic && (
        <EditTopicFileModal
          isOpen={isEditFileModalOpen}
          onClose={() => {
            setIsEditFileModalOpen(false);
            setEditingFileId(null);
          }}
          topicFileId={editingFileId}
          currentTopicId={topic.id}
          currentSubjectId={topic.subject_id}
        />
      )}

      {/* Nested View Topic Modal for subtopics */}
      {isViewTopicModalOpen && (
        <ViewTopicModal
          isOpen={isViewTopicModalOpen}
          onClose={() => setIsViewTopicModalOpen(false)}
          topicId={viewTopicId}
          onTopicUpdated={() => {}}
        />
      )}
    </div>
  );
}
