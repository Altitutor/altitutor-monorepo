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
import { PencilIcon, TrashIcon, Loader2, AlertTriangle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { formatSubjectDisplay, getSubjectColorStyle } from '@/shared/utils';
import {
  useTopicById,
  useTopics,
  useDeleteTopic,
  useTopicsBySubject,
  useTopicFilesByTopic,
  useDeleteTopicFile,
  useTopicUpdate,
} from '../hooks';
import { useSubjects } from '@/features/subjects/hooks/useSubjectsQuery';
import { TopicNode } from './TopicsHierarchy';
import { DraggableTopicsList } from './DraggableTopicsList';
import { DraggableFilesList, type TopicFileWithFile } from './DraggableFilesList';
import { FileCard } from './FileCard';
import { getFileTypeLabel } from '../utils/file-type-icons';
import { groupFilesByType, getNonSolutionFiles, findLinkedSolution } from '../utils/fileDisplay';
import type { Enums } from '@altitutor/shared';
import { AddTopicModal } from './AddTopicModal';
import { AddResourceFileModal } from './AddResourceFileModal';
import { EditTopicFileModal } from './EditTopicFileModal';
import { buildTopicTree } from '../utils/codes';
import { Plus } from 'lucide-react';
import { ActionsMenu } from '@/shared/components/ActionsMenu';

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
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isAddTopicModalOpen, setIsAddTopicModalOpen] = useState(false);
  const [addTopicParentId, setAddTopicParentId] = useState<string | undefined>(undefined);
  const [isAddResourceModalOpen, setIsAddResourceModalOpen] = useState(false);
  const [isViewTopicModalOpen, setIsViewTopicModalOpen] = useState(false);
  const [viewTopicId, setViewTopicId] = useState<string | null>(null);
  const [isEditFileModalOpen, setIsEditFileModalOpen] = useState(false);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [reorderedChildren, setReorderedChildren] = useState<Array<{ id: string; index: number }>>([]);
  const [reorderedFiles, setReorderedFiles] = useState<Array<{ id: string; index: number; type: Enums<'resource_type'> }>>([]);
  const [solutionLinks, setSolutionLinks] = useState<Array<{ solutionFileId: string; targetFileId: string }>>([]);
  const [solutionUnlinks, setSolutionUnlinks] = useState<Array<string>>([]);
  
  const { data: topic, isLoading, error } = useTopicById(topicId);
  const { data: subjects = [] } = useSubjects();
  const { data: allTopics = [] } = useTopics();
  const { data: subjectTopics = [] } = useTopicsBySubject(topic?.subject_id || null);
  const { data: topicFiles = [] } = useTopicFilesByTopic(topicId);
  
  const { updateTopic, isPending: isUpdatingTopic } = useTopicUpdate();
  const deleteTopicMutation = useDeleteTopic();
  const deleteTopicFileMutation = useDeleteTopicFile();

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
    setReorderedChildren([]);
    setReorderedFiles([]);
    setSolutionLinks([]);
    setSolutionUnlinks([]);
    setIsEditing(false);
  };

  const handleTopicReorder = (updates: Array<{ id: string; index: number }>) => {
    setReorderedChildren(updates);
  };

  const onSubmit = async (values: FormData) => {
    if (!topicId || !topic) return;

    const formData = {
      name: values.name,
      subject_id: values.subject_id,
      parent_id: values.parent_id === 'none' ? null : values.parent_id || null,
    };

    const result = await updateTopic({
      topicId,
      currentTopic: topic,
      formData,
      reorderedChildren,
      reorderedFiles,
      solutionLinks,
      solutionUnlinks,
      currentTopicFiles: topicFiles,
    });

    if (result.success) {
      // Clear all pending changes
      setReorderedChildren([]);
      setReorderedFiles([]);
      setSolutionLinks([]);
      setSolutionUnlinks([]);
      setIsEditing(false);

      if (onTopicUpdated) {
        onTopicUpdated();
      }
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
        <SheetContent hideCloseButton className="h-full max-h-[100vh] flex flex-col p-0 w-full md:w-[600px] md:max-w-none">
          <SheetHeader className="flex-shrink-0 px-6 pt-6 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onClose}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                  <SheetTitle className="text-xl">
                    {isLoading ? 'Topic' : isEditing ? 'Edit Topic' : 'Topic Details'}
                  </SheetTitle>
                  {!isLoading && topic && (
                    <SheetDescription className="text-lg font-medium">
                      {topic.code ? `${topic.code} - ` : ''}{topic.name}
                    </SheetDescription>
                  )}
                </div>
              </div>
              {topicId && topic && (
                <ActionsMenu
                  type="topic"
                  onOpenInPage={() => {
                    router.push(`/subjects/${topic.subject_id}/topics/${topicId}`);
                    onClose();
                  }}
                />
              )}
            </div>
          </SheetHeader>
          
          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto px-6 pb-20">
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
            <div className="space-y-8">
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
                        onReorder={(updates) => {
                          // Handle reordering - this would call a batch update API
                          setReorderedChildren(updates);
                        }}
                      />
                    </div>
                  )}

                  {/* Files Section - Edit Mode */}
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-3">Files</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Drag files to reorder within types or change types. Drag solutions to link them to files.
                    </p>
                    {topicFiles.length > 0 ? (
                      <DraggableFilesList
                        files={topicFiles as TopicFileWithFile[]}
                        onReorder={(updates) => {
                          setReorderedFiles(updates);
                        }}
                        onSolutionLink={(solutionFileId, targetFileId) => {
                          setSolutionLinks(prev => {
                            // Remove any existing link for this solution
                            const filtered = prev.filter(link => link.solutionFileId !== solutionFileId);
                            // Add new link
                            return [...filtered, { solutionFileId, targetFileId }];
                          });
                        }}
                        onSolutionUnlink={(solutionFileId) => {
                          setSolutionLinks(prev => {
                            // Remove link for this solution from links
                            return prev.filter(link => link.solutionFileId !== solutionFileId);
                          });
                          // Track that we need to unlink this solution on save
                          setSolutionUnlinks(prev => {
                            if (!prev.includes(solutionFileId)) {
                              return [...prev, solutionFileId];
                            }
                            return prev;
                          });
                        }}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">No files attached to this topic</p>
                    )}
                  </div>
                </form>
              ) : (
                // View Mode
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
                              setViewTopicId(topic.parent_id);
                              setIsViewTopicModalOpen(true);
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
                    
                    <div className="text-sm font-medium">Topic Code:</div>
                    <div>{topic.code || 'N/A'}</div>
                </div>
              
              <Separator className="my-4" />
              
                  {/* Files Section - View Mode */}
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
                      <div className="space-y-6">
                        {(() => {
                          const filesByType = groupFilesByType(topicFiles);
                          
                          return Object.entries(filesByType).map(([type, files]) => {
                            if (files.length === 0) return null;
                            
                            const typeLabel = getFileTypeLabel(type as Enums<'resource_type'>);
                            const nonSolutionFiles = getNonSolutionFiles(files);
                            
                            return (
                              <div key={type} className="space-y-2">
                                <h4 className="font-semibold text-sm">{typeLabel}</h4>
                                <div className="space-y-2">
                                  {nonSolutionFiles.map((topicFile) => {
                                    const code = topicFile.code || '';
                                    const linkedSolution = findLinkedSolution(topicFile.id, files);
                                    
                                    return (
                                      <div key={topicFile.id} className="flex gap-2">
                                        <div className="w-1/2">
                                          <FileCard
                                            fileCode={code}
                                            fileType={topicFile.type}
                                            filename={topicFile.file.filename}
                                            storagePath={topicFile.file.storage_path}
                                            mimeType={topicFile.file.mimetype}
                                            topicFileId={topicFile.id}
                                            fileId={topicFile.file.id}
                                            topicName={topic.name}
                                            onEdit={(id) => {
                                              setEditingFileId(id);
                                              setIsEditFileModalOpen(true);
                                            }}
                                            onDelete={async (id) => {
                                              await deleteTopicFileMutation.mutateAsync(id);
                                            }}
                                          />
                                        </div>
                                        <div className="w-1/2">
                                          {linkedSolution ? (
                                            <FileCard
                                              fileCode={linkedSolution.code || ''}
                                              fileType={linkedSolution.type}
                                              filename={linkedSolution.file.filename}
                                              storagePath={linkedSolution.file.storage_path}
                                              mimeType={linkedSolution.file.mimetype}
                                              topicFileId={linkedSolution.id}
                                              fileId={linkedSolution.file.id}
                                              topicName={topic.name}
                                              onEdit={(id) => {
                                                setEditingFileId(id);
                                                setIsEditFileModalOpen(true);
                                              }}
                                              onDelete={async (id) => {
                                                await deleteTopicFileMutation.mutateAsync(id);
                                              }}
                                            />
                                          ) : (
                                            <div className="h-full border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 flex items-center justify-center min-h-[60px]">
                                              <span className="text-xs text-muted-foreground">No solution</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>

                  <Separator className="my-4" />

                  {/* Subtopics Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold">Subtopics</h3>
                      {!isEditing && (
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
                      )}
                    </div>
                    
                    {childrenTopics.length > 0 ? (
                      isEditing ? (
                        // Edit mode: Show draggable list
                        <DraggableTopicsList
                          topics={childrenTopics}
                          onReorder={handleTopicReorder}
                        />
                      ) : (
                        // View mode: Show hierarchy
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
                      )
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
          </div>
          
          {/* Action buttons at the bottom */}
          {!isLoading && topic && (
            <SheetFooter className="flex-shrink-0 px-6 py-4 border-t bg-background">
              <div className="flex w-full justify-between">
                {isEditing ? (
                  <>
                    <Button 
                      type="button" 
                      variant="destructive" 
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={isUpdatingTopic}
                    >
                      <TrashIcon className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                    
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={isUpdatingTopic}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="button" 
                        disabled={isUpdatingTopic}
                        onClick={form.handleSubmit(onSubmit)}
                      >
                        {isUpdatingTopic ? (
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
                  <div className="flex w-full justify-end">
                    <Button variant="outline" onClick={handleEdit} disabled={!topic}>
                      <PencilIcon className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
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
          onDeleted={() => {
            if (onTopicUpdated) onTopicUpdated();
          }}
        />
      )}

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
