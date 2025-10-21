'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { subjectsApi } from '../api';
import type { Tables, Enums, TablesInsert } from '@altitutor/shared';
import { Loader2 } from 'lucide-react';

interface AddSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubjectAdded: () => void;
}

export function AddSubjectModal({ isOpen, onClose, onSubjectAdded }: AddSubjectModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    year_level: '',
    curriculum: '',
    discipline: '',
    level: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const subjectData: Tables<'subjects'> | TablesInsert<'subjects'> = {
        name: formData.name,
        year_level: formData.year_level ? parseInt(formData.year_level, 10) : null,
        curriculum: formData.curriculum ? (formData.curriculum as Enums<'subject_curriculum'>) : null,
        discipline: formData.discipline ? (formData.discipline as Enums<'subject_discipline'>) : null,
        level: formData.level || null,
      } as TablesInsert<'subjects'>;

      await subjectsApi.createSubject(subjectData);
      
      toast({
        title: 'Success',
        description: 'Subject added successfully',
      });
      
      onSubjectAdded();
      onClose();
      router.refresh();
    } catch (error) {
      console.error('Failed to add subject:', error);
      toast({
        title: 'Error',
        description: 'Failed to add subject. Please try again.',
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
          <SheetTitle className="text-xl">Add New Subject</SheetTitle>
        </SheetHeader>
        
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
              <Label htmlFor="year_level" className="text-right">
                Year Level
              </Label>
              <Input
                id="year_level"
                name="year_level"
                type="number"
                value={formData.year_level}
                onChange={handleChange}
                className="col-span-3"
                min="1"
                max="12"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="curriculum" className="text-right">
                Curriculum
              </Label>
              <Select
                value={formData.curriculum}
                onValueChange={(value) => handleSelectChange('curriculum', value)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select curriculum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={'SACE'}>SACE</SelectItem>
                  <SelectItem value={'IB'}>IB</SelectItem>
                  <SelectItem value={'PRESACE'}>Pre-SACE</SelectItem>
                  <SelectItem value={'PRIMARY'}>Primary</SelectItem>
                  <SelectItem value={'MEDICINE'}>Medicine</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="level" className="text-right">
                Level
              </Label>
              <Input
                id="level"
                name="level"
                value={formData.level}
                onChange={handleChange}
                className="col-span-3"
                placeholder="e.g., HL, SL, ADVANCED, STANDARD"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="discipline" className="text-right">
                Discipline
              </Label>
              <Select
                value={formData.discipline}
                onValueChange={(value) => handleSelectChange('discipline', value)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select discipline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={'MATHEMATICS'}>Mathematics</SelectItem>
                  <SelectItem value={'SCIENCE'}>Science</SelectItem>
                  <SelectItem value={'HUMANITIES'}>Humanities</SelectItem>
                  <SelectItem value={'ENGLISH'}>English</SelectItem>
                  <SelectItem value={'ART'}>Art</SelectItem>
                  <SelectItem value={'LANGUAGE'}>Language</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </form>
        
        {/* Action buttons at the bottom */}
        <SheetFooter className="absolute bottom-0 left-0 right-0 p-6 border-t bg-background">
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              type="button" 
              disabled={isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</>
              ) : 'Add Subject'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
} 