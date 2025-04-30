'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
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
import { topicsApi } from '@/lib/supabase/api';
import { Subtopic, Topic } from '@/lib/supabase/db/types';

interface EditSubtopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtopicId: string | null;
  onSubtopicUpdated: () => void;
}

export function EditSubtopicModal({ isOpen, onClose, subtopicId, onSubtopicUpdated }: EditSubtopicModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    number: 1,
  });

  useEffect(() => {
    if (isOpen && subtopicId) {
      loadSubtopic(subtopicId);
    }
  }, [isOpen, subtopicId]);

  const loadSubtopic = async (id: string) => {
    setLoading(true);
    try {
      const subtopic = await topicsApi.getSubtopic(id);
      if (subtopic) {
        setFormData({
          name: subtopic.name,
          number: subtopic.number,
        });
        
        // Load related topic to display in title
        if (subtopic.topicId) {
          const topicData = await topicsApi.getTopic(subtopic.topicId);
          if (topicData) {
            setTopic(topicData);
          }
        }
      }
    } catch (error) {
      console.error('Error loading subtopic:', error);
      toast({
        title: 'Error',
        description: 'Failed to load subtopic data',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subtopicId) return;
    setSubmitting(true);
    
    try {
      const subtopicData: Partial<Subtopic> = {
        name: formData.name,
        number: formData.number,
      };
      
      await topicsApi.updateSubtopic(subtopicId, subtopicData);
      
      toast({
        title: 'Success',
        description: 'Subtopic updated successfully',
      });
      
      onSubtopicUpdated();
      onClose();
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
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              Edit Subtopic
              {topic && <span className="text-muted-foreground ml-2 font-normal">in {topic.name}</span>}
            </DialogTitle>
            {error && <DialogDescription className="text-destructive">{error}</DialogDescription>}
          </DialogHeader>
          
          {loading ? (
            <div className="py-6 text-center">Loading subtopic data...</div>
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
              </div>
              <DialogFooter className="flex justify-between">
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={submitting}
                >
                  Delete Subtopic
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