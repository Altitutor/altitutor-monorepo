'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@altitutor/ui";
import { 
  AlertTriangle,
  Loader2,
  Pencil,
  Trash2,
  ArrowLeft
} from 'lucide-react';
import { subjectsApi } from '@/features/subjects/api';
import type { Tables, TablesUpdate } from '@altitutor/shared';
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
import { SubjectCurriculumBadge, SubjectDisciplineBadge } from "@altitutor/ui";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@altitutor/ui";
import { Separator } from "@altitutor/ui";
import { TopicsHierarchy, AddTopicModal, AddResourceFileModal } from '@/features/topics';
import { useTopics } from '@/features/topics/hooks';

const formSchema = z.object({
  name: z.string().min(1, "Subject name is required"),
  year_level: z.coerce.number().int().min(1).max(12).nullable(),
  curriculum: z.enum(['SACE','IB','PRESACE','PRIMARY','MEDICINE']).nullable(),
  discipline: z.enum(['MATHEMATICS','SCIENCE','HUMANITIES','ENGLISH','ART','LANGUAGE','MEDICINE']).nullable(),
  level: z.string().nullable(),
  color: z.union([
    z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex code (e.g., #FF5733)"),
    z.literal(''),
    z.null(),
  ]).transform((val) => val === '' ? null : val).nullable(),
});

export default function SubjectDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [subject, setSubject] = useState<Tables<'subjects'> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();
  
  // Topics modals state
  const [isAddTopicModalOpen, setIsAddTopicModalOpen] = useState(false);
  const [addTopicParentId, setAddTopicParentId] = useState<string | undefined>(undefined);
  const [isAddResourceModalOpen, setIsAddResourceModalOpen] = useState(false);
  const [addResourceTopicId, setAddResourceTopicId] = useState<string | undefined>(undefined);
  
  const { data: allTopics = [], refetch: refetchTopics } = useTopics();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      year_level: null,
      curriculum: null,
      discipline: null,
      level: null,
      color: null,
    },
  });

  useEffect(() => {
    if (id) {
      loadSubject(id);
    }
  }, [id]);

  useEffect(() => {
    if (subject) {
      form.reset({
        name: subject.name,
        year_level: subject.year_level,
        curriculum: subject.curriculum as 'SACE' | 'IB' | 'PRESACE' | 'PRIMARY' | 'MEDICINE' | null,
        discipline: subject.discipline as 'MATHEMATICS' | 'SCIENCE' | 'HUMANITIES' | 'ENGLISH' | 'ART' | 'LANGUAGE' | 'MEDICINE' | null,
        level: subject.level,
        color: subject.color || null,
      });
    }
  }, [subject, form]);

  const loadSubject = async (subjectId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await subjectsApi.getSubject(subjectId);
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
        color: subject.color || null,
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
        curriculum: values.curriculum as 'SACE' | 'IB' | 'PRESACE' | 'PRIMARY' | 'MEDICINE' | null,
        discipline: values.discipline as 'MATHEMATICS' | 'SCIENCE' | 'HUMANITIES' | 'ENGLISH' | 'ART' | 'LANGUAGE' | 'MEDICINE' | null,
        level: values.level,
        color: values.color || null,
      };
      
      const updated = await subjectsApi.updateSubject(subject.id, updatedData);
      
      setSubject(updated);
      setIsEditing(false);
      
      toast({
        title: "Subject updated",
        description: `${updated.name} has been updated successfully.`,
      });
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
      
      setDeleteConfirmText('');
      setIsDeleteDialogOpen(false);
      router.push('/subjects');
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

  if (loading && !subject) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !subject) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/subjects')}
            className="border"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            {error || 'Subject Not Found'}
          </h1>
        </div>
        {error && (
          <div className="flex flex-col items-center py-8 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-muted-foreground">{error}</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => id && loadSubject(id)}
            >
              Try Again
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/subjects')}
          className="border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditing ? 'Edit Subject' : 'Subject Details'}
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            {subject.name}
          </p>
        </div>
      </div>

      <div className="space-y-6">
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

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-3">
                        <Input
                          type="color"
                          {...field}
                          value={field.value || '#000000'}
                          onChange={(e) => field.onChange(e.target.value || null)}
                          className="h-10 w-20 cursor-pointer"
                        />
                        <Input
                          type="text"
                          placeholder="#000000"
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '') {
                              field.onChange(null);
                            } else {
                              field.onChange(value);
                            }
                          }}
                          onBlur={(e) => {
                            const value = e.target.value.trim();
                            if (value === '') {
                              field.onChange(null);
                            } else if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
                              if (value.startsWith('#') && /^#[0-9A-Fa-f]{0,6}$/i.test(value)) {
                                field.onChange(value);
                              } else {
                                field.onChange(null);
                              }
                            }
                          }}
                          className="flex-1"
                        />
                      </div>
                    </FormControl>
                    <FormDescription>Hex color code (e.g., #FF5733)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator className="my-6" />

              <div className="pt-4">
                <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => {
                  setIsDeleteDialogOpen(open);
                  if (!open) {
                    setDeleteConfirmText('');
                  }
                }}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" type="button" className="flex items-center w-full">
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
                    <div className="py-4">
                      <FormItem>
                        <FormLabel>
                          Type <strong>{subject.name}</strong> to confirm deletion
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder={subject.name}
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            className="mt-2"
                          />
                        </FormControl>
                      </FormItem>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDeleteSubject}
                        disabled={isDeleting || deleteConfirmText !== subject.name}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
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
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" type="button" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <>
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
                
                <div className="text-sm font-medium">Color:</div>
                <div className="flex items-center gap-2">
                  {subject.color ? (
                    <>
                      <div
                        className="w-6 h-6 rounded border border-gray-300"
                        style={{ backgroundColor: subject.color }}
                      />
                      <span className="text-sm">{subject.color}</span>
                    </>
                  ) : (
                    '-'
                  )}
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <div>
                <h3 className="text-lg font-semibold mb-3">Topics</h3>
                <TopicsHierarchy
                  subjectId={subject.id}
                  showAddTopic={false}
                  showAddResource={false}
                  onTopicClick={(topicId) => {
                    router.push(`/subjects/${id}/topics/${topicId}`);
                  }}
                  onAddTopicClick={(parentId) => {
                    setAddTopicParentId(parentId);
                    setIsAddTopicModalOpen(true);
                  }}
                  onAddResourceClick={(topicId) => {
                    setAddResourceTopicId(topicId);
                    setIsAddResourceModalOpen(true);
                  }}
                  allTopics={allTopics}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button 
                variant="outline" 
                className="flex items-center" 
                onClick={handleEditClick}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Topics Modals */}
      <AddTopicModal
        isOpen={isAddTopicModalOpen}
        onClose={() => {
          setIsAddTopicModalOpen(false);
          refetchTopics();
        }}
        preselectedSubjectId={id}
        preselectedParentId={addTopicParentId}
        onTopicAdded={() => refetchTopics()}
      />
      
      <AddResourceFileModal
        isOpen={isAddResourceModalOpen}
        onClose={() => {
          setIsAddResourceModalOpen(false);
          refetchTopics();
        }}
        preselectedSubjectId={id}
        preselectedTopicId={addResourceTopicId}
        onResourceAdded={() => refetchTopics()}
      />
    </div>
  );
}
