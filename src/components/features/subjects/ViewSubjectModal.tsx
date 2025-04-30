'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle, 
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { subjectsApi } from '@/lib/supabase/api';
import { Subject, SubjectCurriculum, SubjectDiscipline } from '@/lib/supabase/db/types';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

export interface ViewSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectId: string | null;
  onSubjectUpdated?: () => void;
}

export function ViewSubjectModal({ isOpen, onClose, subjectId, onSubjectUpdated }: ViewSubjectModalProps) {
  const [subject, setSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  
  const formSchema = z.object({
    name: z.string().min(1, "Subject name is required"),
    year_level: z.coerce.number().int().min(1).max(12).nullable(),
    curriculum: z.nativeEnum(SubjectCurriculum).nullable(),
    discipline: z.nativeEnum(SubjectDiscipline).nullable(),
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
        curriculum: subject.curriculum,
        discipline: subject.discipline,
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
      const updatedData: Partial<Subject> = {
        name: values.name,
        year_level: values.year_level,
        curriculum: values.curriculum,
        discipline: values.discipline,
        level: values.level,
      };
      
      await subjectsApi.updateSubject(subject.id, updatedData);
      
      const updatedSubject = {
        ...subject,
        ...updatedData,
      };
      
      setSubject(updatedSubject);
      setIsEditing(false);
      
      toast({
        title: "Subject updated",
        description: `${updatedSubject.name} has been updated successfully.`,
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

  const getCurriculumBadge = (curriculum: SubjectCurriculum | null | undefined) => {
    if (!curriculum) return null;
    
    const colorMap: Record<SubjectCurriculum, string> = {
      [SubjectCurriculum.SACE]: 'bg-blue-100 text-blue-800',
      [SubjectCurriculum.IB]: 'bg-purple-100 text-purple-800',
      [SubjectCurriculum.PRESACE]: 'bg-green-100 text-green-800',
      [SubjectCurriculum.PRIMARY]: 'bg-yellow-100 text-yellow-800',
      [SubjectCurriculum.MEDICINE]: 'bg-red-100 text-red-800',
    };
    
    return (
      <Badge className={colorMap[curriculum]}>
        {curriculum}
      </Badge>
    );
  };

  const getDisciplineBadge = (discipline: SubjectDiscipline | null | undefined) => {
    if (!discipline) return null;
    
    const colorMap: Record<SubjectDiscipline, string> = {
      [SubjectDiscipline.MATHEMATICS]: 'bg-indigo-100 text-indigo-800',
      [SubjectDiscipline.SCIENCE]: 'bg-emerald-100 text-emerald-800',
      [SubjectDiscipline.HUMANITIES]: 'bg-amber-100 text-amber-800',
      [SubjectDiscipline.ENGLISH]: 'bg-rose-100 text-rose-800',
      [SubjectDiscipline.ART]: 'bg-pink-100 text-pink-800',
      [SubjectDiscipline.LANGUAGE]: 'bg-cyan-100 text-cyan-800',
      [SubjectDiscipline.MEDICINE]: 'bg-red-100 text-red-800',
    };
    
    return (
      <Badge className={colorMap[discipline]}>
        {discipline}
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(isOpen) => {
      if (!isOpen) onClose();
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {loading ? 'Loading Subject...' : subject?.name || 'Subject Details'}
          </DialogTitle>
        </DialogHeader>

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
          <div className="space-y-6">
            {isEditing ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    <span>Edit Subject Details</span>
                  </CardTitle>
                  <CardDescription>
                    Update subject information below
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                                  <SelectItem value={SubjectCurriculum.SACE}>{SubjectCurriculum.SACE}</SelectItem>
                                  <SelectItem value={SubjectCurriculum.IB}>{SubjectCurriculum.IB}</SelectItem>
                                  <SelectItem value={SubjectCurriculum.PRESACE}>{SubjectCurriculum.PRESACE}</SelectItem>
                                  <SelectItem value={SubjectCurriculum.PRIMARY}>{SubjectCurriculum.PRIMARY}</SelectItem>
                                  <SelectItem value={SubjectCurriculum.MEDICINE}>{SubjectCurriculum.MEDICINE}</SelectItem>
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
                                  <SelectItem value={SubjectDiscipline.MATHEMATICS}>{SubjectDiscipline.MATHEMATICS}</SelectItem>
                                  <SelectItem value={SubjectDiscipline.SCIENCE}>{SubjectDiscipline.SCIENCE}</SelectItem>
                                  <SelectItem value={SubjectDiscipline.HUMANITIES}>{SubjectDiscipline.HUMANITIES}</SelectItem>
                                  <SelectItem value={SubjectDiscipline.ENGLISH}>{SubjectDiscipline.ENGLISH}</SelectItem>
                                  <SelectItem value={SubjectDiscipline.ART}>{SubjectDiscipline.ART}</SelectItem>
                                  <SelectItem value={SubjectDiscipline.LANGUAGE}>{SubjectDiscipline.LANGUAGE}</SelectItem>
                                  <SelectItem value={SubjectDiscipline.MEDICINE}>{SubjectDiscipline.MEDICINE}</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-between items-center mt-6">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" type="button" className="flex items-center">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Subject
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
                          <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                          </Button>
                        </div>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                      <span>Subject Details</span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center" 
                        onClick={handleEditClick}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      Key information about this subject
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Subject Name</h4>
                        <p className="text-base">{subject.name}</p>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Year Level</h4>
                        <p className="text-base">{subject.year_level || '-'}</p>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Curriculum</h4>
                        {subject.curriculum ? (
                          getCurriculumBadge(subject.curriculum)
                        ) : (
                          <p className="text-base">-</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Discipline</h4>
                        {subject.discipline ? (
                          getDisciplineBadge(subject.discipline)
                        ) : (
                          <p className="text-base">-</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Level</h4>
                        <p className="text-base">{subject.level || '-'}</p>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Created At</h4>
                        <p className="text-base">
                          {new Date(subject.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

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
              </>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
} 