'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SubjectCurriculumBadge } from '@/components/ui/enum-badge';
import { Separator } from '@/components/ui/separator';
import { topicsApi } from '../api';
import { subjectsApi } from '@/features/subjects/api';
import type { Topic, Subtopic } from '../types';
import type { Subject } from '@/shared/lib/supabase/database/types';
import { AddSubtopicModal } from './AddSubtopicModal';
import { ViewSubtopicModal } from './ViewSubtopicModal';
import { PencilIcon, PlusIcon, TrashIcon, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { formatSubjectDisplay } from '@/shared/utils';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRouter } from 'next/navigation';

export interface ViewTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicId: string | null;
  onTopicUpdated?: () => void;
}

// Form schema for validation
const formSchema = z.object({
  name: z.string().min(1, "Topic name is required"),
  number: z.coerce.number().int().min(1, "Number must be at least 1"),
  subject_id: z.string().min(1, "Subject is required"),
  area: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

// Function to get a color for a subject based on curriculum
const getSubjectColor = (subject?: Subject): string => {
  if (!subject || !subject.curriculum) return 'bg-gray-100 text-gray-800';
  
  switch (subject.curriculum) {
    case 'SACE':
      return 'bg-blue-100 text-blue-800';
    case 'IB':
      return 'bg-green-100 text-green-800';
    case 'PRESACE':
      return 'bg-purple-100 text-purple-800';
    case 'PRIMARY':
      return 'bg-amber-100 text-amber-800';
    case 'MEDICINE':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export function ViewTopicModal({ isOpen, onClose, topicId, onTopicUpdated }: ViewTopicModalProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modals for subtopics
  const [isAddSubtopicModalOpen, setIsAddSubtopicModalOpen] = useState(false);
  const [viewSubtopicId, setViewSubtopicId] = useState<string | null>(null);
  const [isViewSubtopicModalOpen, setIsViewSubtopicModalOpen] = useState(false);

  // Initialize form
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      number: 1,
      subject_id: "",
      area: "",
    }
  });

  useEffect(() => {
    if (isOpen) {
      loadSubjects();
      if (topicId) {
        loadTopic(topicId);
      }
    } else {
      setIsEditing(false);
    }
  }, [isOpen, topicId]);

  // Update form when topic is loaded
  useEffect(() => {
    if (topic) {
      form.reset({
        name: topic.name,
        number: topic.number,
        subject_id: topic.subjectId,
        area: topic.area || "",
      });
    }
  }, [topic, form]);

  const loadSubjects = async () => {
    try {
      const subjectsData = await subjectsApi.getAllSubjects();
      setSubjects(subjectsData);
    } catch (error) {
      console.error('Error loading subjects:', error);
      toast({
        title: 'Error',
        description: 'Failed to load subjects',
        variant: 'destructive',
      });
    }
  };

  const loadTopic = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      // Load topic with subject data included
      const topicsWithSubjects = await topicsApi.getTopicsWithSubjects();
      const topicData = topicsWithSubjects.find(t => t.id === id);
      
      if (!topicData) {
        throw new Error('Topic not found');
      }
      
      setTopic(topicData);
      
      // Set subject from the topic's subject property
      if (topicData.subject) {
        setSubject(topicData.subject);
      } else if (topicData.subjectId) {
        // Fallback to loading subject directly if not included
        const subjectData = await subjectsApi.getSubject(topicData.subjectId);
        setSubject(subjectData || null);
      }

      // Load subtopics
      const subtopicsData = await topicsApi.getSubtopicsByTopic(id);
      setSubtopics(subtopicsData);
    } catch (error) {
      console.error('Error loading topic:', error);
      setError('Failed to load topic data');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (topic) {
      form.reset({
        name: topic.name,
        number: topic.number,
        subject_id: topic.subjectId,
        area: topic.area || "",
      });
    }
    setIsEditing(false);
  };

  const onSubmit = async (values: FormData) => {
    if (!topicId) return;
    
    setSubmitting(true);
    
    try {
      const topicData: Partial<Topic> = {
        name: values.name,
        number: values.number,
        subjectId: values.subject_id,
        area: values.area || null,
      };
      
      await topicsApi.updateTopic(topicId, topicData);
      
      // Update local topic data
      const updatedTopic = {
        ...topic!,
        ...topicData,
      };
      
      setTopic(updatedTopic as Topic);
      
      // Reload subject data if it changed
      if (topic?.subjectId !== values.subject_id) {
        try {
          const subjectData = await subjectsApi.getSubject(values.subject_id);
          setSubject(subjectData || null);
        } catch (error) {
          console.error('Error loading updated subject:', error);
          setSubject(null);
        }
      }
      
      toast({
        title: 'Success',
        description: 'Topic updated successfully',
      });
      
      setIsEditing(false);
      
      if (onTopicUpdated) {
        onTopicUpdated();
      }
      
      router.refresh();
    } catch (error) {
      console.error('Failed to update topic:', error);
      toast({
        title: 'Error',
        description: 'Failed to update topic. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!topicId) return;
    setSubmitting(true);
    
    try {
      await topicsApi.deleteTopic(topicId);
      
      toast({
        title: 'Success',
        description: 'Topic deleted successfully',
      });
      
      if (onTopicUpdated) {
        onTopicUpdated();
      }
      
      setShowDeleteDialog(false);
      onClose();
      router.refresh();
    } catch (error) {
      console.error('Failed to delete topic:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete topic. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSubtopic = () => {
    setIsAddSubtopicModalOpen(true);
  };

  const handleEditSubtopic = (subtopicId: string) => {
    setViewSubtopicId(subtopicId);
    setIsViewSubtopicModalOpen(true);
  };

  const handleChange = () => {
    if (topicId) {
      loadTopic(topicId);
    }
    if (onTopicUpdated) {
      onTopicUpdated();
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="h-full max-h-[100vh] overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl">
              {loading ? 'Topic' : isEditing ? 'Edit Topic' : 'Topic'}
            </SheetTitle>
            {!loading && topic && (
              <SheetDescription className="text-lg font-medium">
                {topic.name}
              </SheetDescription>
            )}
          </SheetHeader>
          
          {loading ? (
            <div className="py-6 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p>Loading topic data...</p>
            </div>
          ) : error ? (
            <div className="py-6 text-center text-destructive">
              <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
              <p>{error}</p>
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
                      <Label htmlFor="number" className="text-right">
                        Number
                      </Label>
                      <Input
                        id="number"
                        type="number"
                        {...form.register('number', { valueAsNumber: true })}
                        className="col-span-3"
                        min="1"
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
                      <Label htmlFor="area" className="text-right">
                        Area
                      </Label>
                      <Input
                        id="area"
                        {...form.register('area')}
                        className="col-span-3"
                        placeholder="Optional area or category"
                      />
                    </div>
                  </div>
                </form>
              ) : (
                // View Mode
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div className="text-sm font-medium">Name:</div>
                    <div>{topic.name}</div>
                    
                    <div className="text-sm font-medium">Number:</div>
                    <div>{topic.number}</div>
                    
                    <div className="text-sm font-medium">Subject:</div>
                    <div>
                      {subject ? (
                        <SubjectCurriculumBadge value={subject.curriculum} />
                      ) : 'N/A'}
                    </div>
                    
                    {topic.area && (
                      <>
                        <div className="text-sm font-medium">Area:</div>
                        <div>{topic.area}</div>
                      </>
                    )}
                  </div>
                </div>
              )}
              
              <Separator className="my-4" />
              
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Subtopics</h3>
                  <Button size="sm" variant="outline" onClick={handleAddSubtopic}>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Subtopic
                  </Button>
                </div>
                
                {subtopics.length > 0 ? (
                  <div className="space-y-3">
                    {subtopics.map((subtopic) => (
                      <div key={subtopic.id} className="p-3 border rounded-md flex items-center justify-between">
                        <div>
                          <span className="font-medium">
                            {subtopic.number}. {subtopic.name}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleEditSubtopic(subtopic.id)}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    No subtopics found for this topic.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-destructive">
              Topic not found or has been deleted.
            </div>
          )}
          
          {/* Action buttons at the bottom */}
          {!loading && topic && (
            <SheetFooter className="absolute bottom-0 left-0 right-0 p-6 border-t bg-background">
              <div className="flex w-full justify-between">
                {isEditing ? (
                  <>
                    <Button 
                      type="button" 
                      variant="destructive" 
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={submitting}
                    >
                      <TrashIcon className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                    
                    <div className="flex space-x-2">
                      <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={submitting}>
                        Cancel
                      </Button>
                      <Button 
                        type="button" 
                        disabled={submitting}
                        onClick={form.handleSubmit(onSubmit)}
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : 'Save Changes'}
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleEdit}
                    disabled={!topic}
                    className="flex items-center"
                  >
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
              This action cannot be undone. This will permanently delete the topic
              and all its subtopics.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? 'Deleting...' : 'Delete Topic'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Subtopic Modals */}
      <AddSubtopicModal
        isOpen={isAddSubtopicModalOpen}
        onClose={() => setIsAddSubtopicModalOpen(false)}
        topicId={topicId}
        onSubtopicAdded={handleChange}
      />
      
      <ViewSubtopicModal
        isOpen={isViewSubtopicModalOpen}
        onClose={() => setIsViewSubtopicModalOpen(false)}
        subtopicId={viewSubtopicId}
        onSubtopicUpdated={handleChange}
      />
    </>
  );
} 