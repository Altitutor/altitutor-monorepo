'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { subjectsApi } from '@/lib/supabase/api';
import { Subject, SubjectCurriculum, SubjectDiscipline } from '@/lib/supabase/db/types';

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
      const subjectData: Partial<Subject> = {
        name: formData.name,
        year_level: formData.year_level ? parseInt(formData.year_level, 10) : null,
        curriculum: formData.curriculum ? (formData.curriculum as SubjectCurriculum) : null,
        discipline: formData.discipline ? (formData.discipline as SubjectDiscipline) : null,
        level: formData.level || null,
      };

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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Subject</DialogTitle>
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
                  <SelectItem value={SubjectCurriculum.SACE}>SACE</SelectItem>
                  <SelectItem value={SubjectCurriculum.IB}>IB</SelectItem>
                  <SelectItem value={SubjectCurriculum.PRESACE}>Pre-SACE</SelectItem>
                  <SelectItem value={SubjectCurriculum.PRIMARY}>Primary</SelectItem>
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
                  <SelectItem value={SubjectDiscipline.MATHEMATICS}>Mathematics</SelectItem>
                  <SelectItem value={SubjectDiscipline.SCIENCE}>Science</SelectItem>
                  <SelectItem value={SubjectDiscipline.HUMANITIES}>Humanities</SelectItem>
                  <SelectItem value={SubjectDiscipline.ENGLISH}>English</SelectItem>
                  <SelectItem value={SubjectDiscipline.ART}>Art</SelectItem>
                  <SelectItem value={SubjectDiscipline.LANGUAGE}>Language</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Subject'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 