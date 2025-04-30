'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { topicsApi } from '@/lib/supabase/api';
import { Topic, Subtopic } from '@/lib/supabase/db/types';

interface AddSubtopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicId: string | null;
  onSubtopicAdded: () => void;
}

export function AddSubtopicModal({ isOpen, onClose, topicId, onSubtopicAdded }: AddSubtopicModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    number: 1,
  });

  useEffect(() => {
    if (isOpen && topicId) {
      loadTopic();
      // Reset form when modal opens
      setFormData({
        name: '',
        number: 1,
      });
    }
  }, [isOpen, topicId]);

  const loadTopic = async () => {
    if (!topicId) return;
    
    try {
      const topicData = await topicsApi.getTopic(topicId);
      setTopic(topicData || null);
      
      // Set next available number based on existing subtopics
      if (topicData) {
        const subtopics = await topicsApi.getSubtopicsByTopic(topicId);
        if (subtopics && subtopics.length > 0) {
          const maxNumber = Math.max(...subtopics.map(s => s.number));
          setFormData(prev => ({ ...prev, number: maxNumber + 1 }));
        }
      }
    } catch (error) {
      console.error('Error loading topic:', error);
      toast({
        title: 'Error',
        description: 'Failed to load topic data',
        variant: 'destructive',
      });
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
    
    if (!topicId) {
      toast({
        title: 'Error',
        description: 'No topic selected',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);

    try {
      const subtopicData: Partial<Subtopic> = {
        name: formData.name,
        number: formData.number,
        topicId: topicId,
      };

      await topicsApi.createSubtopic(subtopicData);
      
      toast({
        title: 'Success',
        description: 'Subtopic added successfully',
      });
      
      onSubtopicAdded();
      onClose();
    } catch (error) {
      console.error('Failed to add subtopic:', error);
      toast({
        title: 'Error',
        description: 'Failed to add subtopic. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            Add Subtopic
            {topic && <span className="text-muted-foreground ml-2 font-normal">to {topic.name}</span>}
          </DialogTitle>
        </DialogHeader>
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
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !topicId}>
              {isSubmitting ? 'Adding...' : 'Add Subtopic'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 