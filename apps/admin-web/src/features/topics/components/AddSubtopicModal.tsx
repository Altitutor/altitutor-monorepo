'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { topicsApi } from '../api';
import type { Topic, Subtopic } from '../types';
import { Loader2 } from 'lucide-react';

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
  const [loading, setLoading] = useState(false);
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
    
    setLoading(true);
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
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="h-full max-h-[100vh] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl">Add Subtopic</SheetTitle>
          {topic && (
            <SheetDescription className="text-lg font-medium">
              to {topic.name}
            </SheetDescription>
          )}
        </SheetHeader>
        
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading topic data...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="pb-20">
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
          </form>
        )}
        
        {/* Action buttons at the bottom */}
        <SheetFooter className="absolute bottom-0 left-0 right-0 p-6 border-t bg-background">
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting || loading}>
              Cancel
            </Button>
            <Button 
              type="button" 
              disabled={isSubmitting || loading || !topicId}
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</>
              ) : 'Add Subtopic'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
} 