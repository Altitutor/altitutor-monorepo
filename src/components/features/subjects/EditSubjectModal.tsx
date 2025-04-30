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
import { subjectsApi } from '@/lib/supabase/api';
import { Subject, SubjectCurriculum, SubjectDiscipline } from '@/lib/supabase/db/types';

interface EditSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectId: string | null;
  onSubjectUpdated: () => void;
}

export function EditSubjectModal({ isOpen, onClose, subjectId, onSubjectUpdated }: EditSubjectModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    year_level: '',
    curriculum: '',
    discipline: '',
    level: '',
  });

  useEffect(() => {
    if (isOpen && subjectId) {
      loadSubject();
    }
  }, [isOpen, subjectId]);

  const loadSubject = async () => {
    if (!subjectId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const subject = await subjectsApi.getSubject(subjectId);
      if (!subject) {
        throw new Error('Subject not found');
      }
      
      setFormData({
        name: subject.name,
        year_level: subject.year_level ? subject.year_level.toString() : '',
        curriculum: subject.curriculum || '',
        discipline: subject.discipline || '',
        level: subject.level || '',
      });
    } catch (err) {
      console.error('Error loading subject:', err);
      setError('Failed to load subject data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subjectId) return;
    setSubmitting(true);
    
    try {
      const subjectData: Partial<Subject> = {
        name: formData.name,
        year_level: formData.year_level ? parseInt(formData.year_level, 10) : null,
        curriculum: formData.curriculum ? (formData.curriculum as SubjectCurriculum) : null,
        discipline: formData.discipline ? (formData.discipline as SubjectDiscipline) : null,
        level: formData.level || null,
      };
      
      await subjectsApi.updateSubject(subjectId, subjectData);
      
      toast({
        title: 'Success',
        description: 'Subject updated successfully',
      });
      
      onSubjectUpdated();
      onClose();
      router.refresh();
    } catch (error) {
      console.error('Failed to update subject:', error);
      toast({
        title: 'Error',
        description: 'Failed to update subject. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!subjectId) return;
    setSubmitting(true);
    
    try {
      await subjectsApi.deleteSubject(subjectId);
      
      toast({
        title: 'Success',
        description: 'Subject deleted successfully',
      });
      
      onSubjectUpdated();
      setShowDeleteDialog(false);
      onClose();
      router.refresh();
      router.push('/dashboard/subjects');
    } catch (error) {
      console.error('Failed to delete subject:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete subject. Please try again.',
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
            <DialogTitle>Edit Subject</DialogTitle>
            {error && <DialogDescription className="text-destructive">{error}</DialogDescription>}
          </DialogHeader>
          
          {loading ? (
            <div className="py-6 text-center">Loading subject data...</div>
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
                      <SelectItem value="">None</SelectItem>
                      <SelectItem value={SubjectCurriculum.SACE}>SACE</SelectItem>
                      <SelectItem value={SubjectCurriculum.IB}>IB</SelectItem>
                      <SelectItem value={SubjectCurriculum.PRESACE}>Pre-SACE</SelectItem>
                      <SelectItem value={SubjectCurriculum.PRIMARY}>Primary</SelectItem>
                      <SelectItem value={SubjectCurriculum.MEDICINE}>Medicine</SelectItem>
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
                      <SelectItem value="">None</SelectItem>
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
              <DialogFooter className="flex justify-between">
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={submitting}
                >
                  Delete Subject
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
              This action cannot be undone. This will permanently delete the subject
              and remove all associated data including student enrollments, staff assignments,
              topics, and other related records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? 'Deleting...' : 'Delete Subject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 