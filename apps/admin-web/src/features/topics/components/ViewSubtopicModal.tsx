'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
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
import { topicsApi } from '../api';
import type { Tables, TablesUpdate } from '@altitutor/shared';
import { PencilIcon, TrashIcon, Loader2, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Badge } from '@/components/ui/badge';
import { Separator as UISeparator } from '@/components/ui/separator';

interface ViewSubtopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtopicId: string | null;
  onSubtopicUpdated: () => void;
}

// Form schema for validation
const formSchema = z.object({
  name: z.string().min(1, "Subtopic name is required"),
  number: z.coerce.number().int().min(1, "Number must be at least 1"),
});

type FormData = z.infer<typeof formSchema>;

export function ViewSubtopicModal({ isOpen, onClose, subtopicId, onSubtopicUpdated }: ViewSubtopicModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState<Tables<'topics'> | null>(null);
  const [subtopic, setSubtopic] = useState<Tables<'subtopics'> | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Initialize form
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      number: 1,
    }
  });

  useEffect(() => {
    if (isOpen && subtopicId) {
      loadSubtopic(subtopicId);
    } else {
      setSubtopic(null);
      setTopic(null);
      setError(null);
      setIsEditing(false);
    }
  }, [isOpen, subtopicId]);

  // Update form when subtopic is loaded
  useEffect(() => {
    if (subtopic) {
      form.reset({
        name: subtopic.name,
        number: subtopic.number,
      });
    }
  }, [subtopic, form]);

  const loadSubtopic = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const subtopicData = await topicsApi.getSubtopic(id);
      if (subtopicData) {
        setSubtopic(subtopicData);
        
        // Load related topic to display in title
        if (subtopicData.topic_id) {
          const topicData = await topicsApi.getTopic(subtopicData.topic_id);
          if (topicData) {
            setTopic(topicData);
          }
        }
      } else {
        setError("Subtopic not found");
      }
    } catch (error) {
      console.error('Error loading subtopic:', error);
      setError('Failed to load subtopic data');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (subtopic) {
      form.reset({
        name: subtopic.name,
        number: subtopic.number,
      });
    }
    setIsEditing(false);
  };

  const onSubmit = async (values: FormData) => {
    if (!subtopicId) return;
    
    setSubmitting(true);
    
    try {
      const subtopicData: TablesUpdate<'subtopics'> = {
        name: values.name,
        number: values.number,
      };
      
      const updated = await topicsApi.updateSubtopic(subtopicId, subtopicData);
      
      // Update local state
      setSubtopic(updated);
      
      toast({
        title: 'Success',
        description: 'Subtopic updated successfully',
      });
      
      setIsEditing(false);
      onSubtopicUpdated();
    } catch (error) {
      console.error('Failed to update subtopic:', error);
      toast({
        title: 'Error',
        description: 'Failed to update subtopic. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!subtopicId) return;
    setSubmitting(true);
    
    try {
      await topicsApi.deleteSubtopic(subtopicId);
      
      toast({
        title: 'Success',
        description: 'Subtopic deleted successfully',
      });
      
      onSubtopicUpdated();
      setShowDeleteDialog(false);
      onClose();
    } catch (error) {
      console.error('Failed to delete subtopic:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete subtopic. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="h-full max-h-[100vh] overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl">
              {loading ? 'Subtopic' : isEditing ? 'Edit Subtopic' : 'Subtopic'}
            </SheetTitle>
            {!loading && subtopic && (
              <SheetDescription className="text-lg font-medium">
                {subtopic.name}
                {topic && <span className="text-muted-foreground ml-2 font-normal">{`(in ${topic.name})`}</span>}
              </SheetDescription>
            )}
            {error && <p className="text-destructive text-sm">{error}</p>}
          </SheetHeader>
          
          {loading ? (
            <div className="py-6 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p>Loading subtopic data...</p>
            </div>
          ) : subtopic ? (
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
                  </div>
                </form>
              ) : (
                // View Mode
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div className="text-sm font-medium">Name:</div>
                    <div>{subtopic.name}</div>
                    
                    <div className="text-sm font-medium">Number:</div>
                    <div>{subtopic.number}</div>
                    
                    {topic && (
                      <>
                        <div className="text-sm font-medium">Parent Topic:</div>
                        <div>{topic.name}</div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-6 text-center text-destructive">
              Subtopic not found or has been deleted.
            </div>
          )}
          
          {/* Action buttons at the bottom */}
          {!loading && subtopic && (
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
                      <TrashIcon className="mr-2 h-4 w-4" />
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
                    className="flex items-center" 
                    onClick={handleEditClick}
                  >
                    <PencilIcon className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                )}
              </div>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
      
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the subtopic.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? 'Deleting...' : 'Delete Subtopic'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 