'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { useToast } from '@altitutor/ui';
import { topicsApi } from '../api';
import { subjectsApi } from '@/features/subjects/api';
import type { Tables, TablesInsert } from '@altitutor/shared';
import { formatSubjectDisplay } from '@/shared/utils';
import { Loader2 } from 'lucide-react';

interface AddTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTopicAdded: () => void;
}

export function AddTopicModal({ isOpen, onClose, onTopicAdded }: AddTopicModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subjects, setSubjects] = useState<Tables<'subjects'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    number: 1,
    subject_id: '',
    area: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadSubjects();
    }
  }, [isOpen]);

  const loadSubjects = async () => {
    setLoading(true);
    try {
      const subjectsData = await subjectsApi.getAllSubjects();
      setSubjects(subjectsData);
    } catch (error) {
      console.error('Error loading subjects:', error);
      toast({
        title: 'Error',
        description: 'Failed to load subjects. Please try again.',
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
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const topicData: Tables<'topics'> | TablesInsert<'topics'> = {
        name: formData.name,
        number: formData.number,
        subject_id: formData.subject_id,
        area: formData.area || null,
      } as any;

      await topicsApi.createTopic(topicData);
      
      toast({
        title: 'Success',
        description: 'Topic added successfully',
      });
      
      // Reset form data
      setFormData({
        name: '',
        number: 1,
        subject_id: '',
        area: '',
      });
      
      onTopicAdded();
      onClose();
      router.refresh();
    } catch (error) {
      console.error('Failed to add topic:', error);
      toast({
        title: 'Error',
        description: 'Failed to add topic. Please try again.',
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
          <SheetTitle className="text-xl">Add New Topic</SheetTitle>
        </SheetHeader>
        
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading subjects...</span>
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
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="subject_id" className="text-right">
                  Subject
                </Label>
                <Select
                  value={formData.subject_id}
                  onValueChange={(value) => handleSelectChange('subject_id', value)}
                  disabled={loading}
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
              disabled={isSubmitting || loading}
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</>
              ) : 'Add Topic'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
} 