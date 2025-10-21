'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription,
} from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { 
  AlertTriangle,
  BookOpen,
  FileText,
  Info,
  Loader2,
  Pencil,
  Users,
  UserCog,
  Trash2
} from 'lucide-react';
import { subjectsApi } from '../api';
import type { Tables, Enums, TablesUpdate } from '@altitutor/shared';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@altitutor/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@altitutor/ui";
import { Badge } from "@altitutor/ui";
import { SubjectCurriculumBadge, SubjectDisciplineBadge } from "@altitutor/ui";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@altitutor/ui";
import { useRouter } from "next/navigation";
import { Separator } from "@altitutor/ui";

export interface ViewSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectId: string | null;
  onSubjectUpdated?: () => void;
}

export function ViewSubjectModal({ isOpen, onClose, subjectId, onSubjectUpdated }: ViewSubjectModalProps) {
  const [subject, setSubject] = useState<Tables<'subjects'> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  
  const formSchema = z.object({
    name: z.string().min(1, "Subject name is required"),
    year_level: z.coerce.number().int().min(1).max(12).nullable(),
    curriculum: z.enum(['SACE','IB','PRESACE','PRIMARY','MEDICINE']).nullable(),
    discipline: z.enum(['MATHEMATICS','SCIENCE','HUMANITIES','ENGLISH','ART','LANGUAGE','MEDICINE']).nullable(),
    level: z.string().nullable(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      year_level: null,
      curriculum: null,
      discipline: null,
      level: null,
    },
  });

  useEffect(() => {
    if (isOpen && subjectId) {
      loadSubject(subjectId);
    } else {
      setSubject(null);
      setError(null);
    }
  }, [isOpen, subjectId]);

  useEffect(() => {
    if (subject) {
      form.reset({
        name: subject.name,
        year_level: subject.year_level,
        curriculum: subject.curriculum as any,
        discipline: subject.discipline as any,
        level: subject.level,
      });
    }
  }, [subject, form]);

  const loadSubject = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await subjectsApi.getSubject(id);
      if (data) {
        setSubject(data);
      } else {
        setError('Subject not found.');
      }
    } catch (err) {
      console.error('Failed to load subject:', err);
      setError('Failed to load subject details.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (subject) {
      form.reset({
        name: subject.name,
        year_level: subject.year_level,
        curriculum: subject.curriculum,
        discipline: subject.discipline,
        level: subject.level,
      });
    }
    setIsEditing(false);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!subject) return;
    
    try {
      setLoading(true);
      const updatedData: TablesUpdate<'subjects'> = {
        name: values.name,
        year_level: values.year_level,
        curriculum: values.curriculum as any,
        discipline: values.discipline as any,
        level: values.level,
      };
      
      const updated = await subjectsApi.updateSubject(subject.id, updatedData);
      
      setSubject(updated);
      setIsEditing(false);
      
      toast({
        title: "Subject updated",
        description: `${updated.name} has been updated successfully.`,
      });
      
      if (onSubjectUpdated) {
        onSubjectUpdated();
      }
    } catch (err) {
      console.error('Failed to update subject:', err);
      toast({
        title: "Update failed",
        description: "There was an error updating the subject. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubject = async () => {
    if (!subject) return;
    
    try {
      setIsDeleting(true);
      await subjectsApi.deleteSubject(subject.id);
      
      toast({
        title: "Subject deleted",
        description: `${subject.name} has been deleted successfully.`,
      });
      
      onClose();
      
      if (onSubjectUpdated) {
        onSubjectUpdated();
      }
    } catch (err) {
      console.error('Failed to delete subject:', err);
      toast({
        title: "Delete failed",
        description: "There was an error deleting the subject. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const navigateTo = (path: string) => {
    router.push(path);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(isOpen) => {
      if (!isOpen) onClose();
    }}>
      <SheetContent className="h-full max-h-[100vh] overflow-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl">
            {loading ? 'Subject' : isEditing ? 'Edit Subject' : 'Subject'}
          </SheetTitle>
          {!loading && subject && (
            <SheetDescription className="text-lg font-medium">
              {subject.name}
            </SheetDescription>
          )}
        </SheetHeader>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading subject details...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-8 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold">Error Loading Subject</h3>
            <p className="text-muted-foreground">{error}</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => subjectId && loadSubject(subjectId)}
            >
              Try Again
            </Button>
          </div>
        ) : subject ? (
          <div className="space-y-8">
            {isEditing ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter subject name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="year_level"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Year Level</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="Enter year level" 
                              {...field} 
                              onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value))}
                              value={field.value === null ? '' : field.value}
                            />
                          </FormControl>
                          <FormDescription>Year level from 1-12</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="level"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Level</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. HL, SL, ADVANCED" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormDescription>For IB or PRESACE subjects</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="curriculum"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Curriculum</FormLabel>
                  <Select 
                            onValueChange={value => field.onChange(value || null)} 
                            value={field.value || ""} 
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select curriculum" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={'SACE'}>{'SACE'}</SelectItem>
                              <SelectItem value={'IB'}>{'IB'}</SelectItem>
                              <SelectItem value={'PRESACE'}>{'PRESACE'}</SelectItem>
                              <SelectItem value={'PRIMARY'}>{'PRIMARY'}</SelectItem>
                              <SelectItem value={'MEDICINE'}>{'MEDICINE'}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="discipline"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discipline</FormLabel>
                  <Select 
                            onValueChange={value => field.onChange(value || null)} 
                            value={field.value || ""} 
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select discipline" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={'MATHEMATICS'}>{'MATHEMATICS'}</SelectItem>
                              <SelectItem value={'SCIENCE'}>{'SCIENCE'}</SelectItem>
                              <SelectItem value={'HUMANITIES'}>{'HUMANITIES'}</SelectItem>
                              <SelectItem value={'ENGLISH'}>{'ENGLISH'}</SelectItem>
                              <SelectItem value={'ART'}>{'ART'}</SelectItem>
                              <SelectItem value={'LANGUAGE'}>{'LANGUAGE'}</SelectItem>
                              <SelectItem value={'MEDICINE'}>{'MEDICINE'}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </form>
              </Form>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div className="text-sm font-medium">Name:</div>
                  <div>{subject.name}</div>
                  
                  <div className="text-sm font-medium">Year Level:</div>
                  <div>{subject.year_level || '-'}</div>
                  
                  <div className="text-sm font-medium">Curriculum:</div>
                  <div>
                    {subject.curriculum ? <SubjectCurriculumBadge value={subject.curriculum} /> : '-'}
                  </div>
                  
                  <div className="text-sm font-medium">Discipline:</div>
                  <div>
                    {subject.discipline ? <SubjectDisciplineBadge value={subject.discipline} /> : '-'}
                  </div>
                  
                  <div className="text-sm font-medium">Level:</div>
                  <div>{subject.level || '-'}</div>
                  
                </div>
                
                <Separator className="my-4" />
                
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="flex items-center" onClick={() => navigateTo('/dashboard/topics')}>
                    <BookOpen className="mr-2 h-4 w-4" />
                    Topics
                  </Button>
                  <Button variant="outline" className="flex items-center" onClick={() => navigateTo('/dashboard/students')}>
                    <Users className="mr-2 h-4 w-4" />
                    Students
                  </Button>
                  <Button variant="outline" className="flex items-center" onClick={() => navigateTo('/dashboard/staff')}>
                    <UserCog className="mr-2 h-4 w-4" />
                    Staff
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}
        
        {/* Action buttons at the bottom */}
        {!loading && subject && (
          <SheetFooter className="absolute bottom-0 left-0 right-0 p-6 border-t bg-background">
            <div className="flex w-full justify-between">
              {isEditing ? (
                <>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" type="button" className="flex items-center">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the subject
                          "{subject.name}" and all associated data from the database.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDeleteSubject}
                          disabled={isDeleting}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {isDeleting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            'Delete'
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <div className="flex space-x-2">
                    <Button variant="outline" type="button" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                    <Button 
                      type="button"
                      disabled={loading}
                      onClick={form.handleSubmit(onSubmit)}
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    className="flex items-center" 
                    onClick={handleEditClick}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                </>
              )}
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
} 