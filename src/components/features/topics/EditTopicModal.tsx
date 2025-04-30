'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { topicsApi, subjectsApi } from '@/lib/supabase/api';
import { Subject, Topic, SubjectCurriculum } from '@/lib/supabase/db/types';
import { formatSubjectDisplay } from '@/lib/utils';

interface EditTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicId: string | null;
  onTopicUpdated: () => void;
}

export function EditTopicModal({ isOpen, onClose, topicId, onTopicUpdated }: EditTopicModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    number: 1,
    subject_id: '',
    area: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadSubjects();
      if (topicId) {
        loadTopic(topicId);
      }
    }
  }, [isOpen, topicId]);

  const loadSubjects = async () => {
    try {
      const subjectsData = await subjectsApi.getAllSubjects();
      console.log('Loaded subjects for edit modal:', subjectsData);
      setSubjects(subjectsData);
    } catch (error) {
      console.error('Error loading subjects:', error);
      setError('Failed to load subjects. Please try again.');
    }
  };

  const loadTopic = async (id: string) => {
    setLoading(true);
    try {
      const topic = await topicsApi.getTopic(id);
      if (topic) {
        setFormData({
          name: topic.name,
          number: topic.number,
          subject_id: topic.subjectId, 
          area: topic.area || '',
        });
      }
    } catch (error) {
      console.error('Error loading topic:', error);
      toast({
        title: 'Error',
        description: 'Failed to load topic data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value)) {
      setFormData((prev) => ({ ...prev, number: value }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    console.log(`Selecting ${name}: ${value}`);
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!topicId) return;
    setSubmitting(true);
    
    try {
      const topicData: Partial<Topic> = {
        name: formData.name,
        number: formData.number,
        subjectId: formData.subject_id,
        area: formData.area || null,
      };
      
      await topicsApi.updateTopic(topicId, topicData);
      
      toast({
        title: 'Success',
        description: 'Topic updated successfully',
      });
      
      onTopicUpdated();
      onClose();
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
      
      onTopicUpdated();
      setShowDeleteDialog(false);
      onClose();
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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Topic</DialogTitle>
            {error && <DialogDescription className="text-destructive">{error}</DialogDescription>}
          </DialogHeader>
          
          {loading ? (
            <div className="py-6 text-center">Loading topic data...</div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
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
                    name="number"
                    type="number"
                    value={formData.number}
                    onChange={handleNumberChange}
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
                    value={formData.subject_id}
                    onValueChange={(value) => handleSelectChange('subject_id', value)}
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
                    name="area"
                    value={formData.area}
                    onChange={handleChange}
                    className="col-span-3"
                    placeholder="Optional area or category"
                  />
                </div>
              </div>
              <DialogFooter className="flex justify-between">
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={submitting}
                >
                  Delete Topic
                </Button>
                <div className="flex space-x-2">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      
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
    </>
  );
} 