'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Label } from "@altitutor/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@altitutor/ui";
import { Checkbox } from "@altitutor/ui";
import { PhoneInput } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@altitutor/ui";
import { ScrollArea } from "@altitutor/ui";
import { Badge } from "@altitutor/ui";
import { useCreateStudent } from '../hooks/useStudentsQuery';
import { useSubjects } from '@/features/subjects/hooks/useSubjectsQuery';
import { studentsApi } from '../api';
import { formatSubjectDisplay } from '@/shared/utils';
import { useForm, Controller, SubmitHandler, useFieldArray, type FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, AlertTriangle, Plus, X } from 'lucide-react';
import type { Tables, TablesInsert } from '@altitutor/shared';
import { useCreateParent } from '@/features/parents/hooks/useParentsQuery';
import { useQueryClient } from '@tanstack/react-query';

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStudentAdded: () => void;
}

// Schema for form validation
const formSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  studentEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  studentPhone: z
    .union([
      z.string().regex(/^\+?[0-9]{10,14}$/, 'Invalid phone number format'),
      z.literal(''),
      z.null()
    ])
    .transform((val) => val === '' ? null : val)
    .optional()
    .nullable(),
  school: z.string().optional(),
  curriculum: z.enum(['SACE', 'IB', 'PRESACE', 'PRIMARY', 'MEDICINE']).optional().nullable(),
  yearLevel: z.union([
    z.number().int().min(1).max(12),
    z.string().regex(/^\d+$/).transform(Number),
    z.literal('').transform(() => null),
    z.null()
  ]).optional().nullable(),
  status: z.enum(['TRIAL', 'ACTIVE', 'INACTIVE', 'DISCONTINUED']),
  
  // Availability checkboxes - required values in schema
  availability_monday: z.boolean(),
  availability_tuesday: z.boolean(),
  availability_wednesday: z.boolean(),
  availability_thursday: z.boolean(),
  availability_friday: z.boolean(),
  availability_saturday_am: z.boolean(),
  availability_saturday_pm: z.boolean(),
  availability_sunday_am: z.boolean(),
  availability_sunday_pm: z.boolean(),
  // Optional parents array
  parents: z.array(z.object({
    first_name: z.string().optional().or(z.literal('')),
    last_name: z.string().optional().or(z.literal('')),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    phone: z
      .union([
        z.string().regex(/^\+?[0-9]{10,14}$/, 'Invalid phone number format'),
        z.literal(''),
        z.null()
      ])
      .transform((val) => val === '' ? null : val)
      .optional()
      .nullable(),
  })).optional().default([]),
});

type FormData = z.infer<typeof formSchema>;

export function AddStudentModal({ isOpen, onClose, onStudentAdded }: AddStudentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createStudentMutation = useCreateStudent();
  const createParentMutation = useCreateParent();
  const { data: allSubjects = [] } = useSubjects();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<Tables<'subjects'>[]>([]);
  const [isAddSubjectPopoverOpen, setIsAddSubjectPopoverOpen] = useState(false);
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
  
  const { 
    control, 
    register, 
    handleSubmit, 
    reset,
    formState: { errors } 
  } = useForm<FormData>({
    // @ts-expect-error - Type mismatch due to duplicate react-hook-form types in node_modules
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      studentEmail: '',
      studentPhone: '',
      school: '',
      curriculum: null,
      yearLevel: null,
      status: 'TRIAL',
      availability_monday: false,
      availability_tuesday: false,
      availability_wednesday: false,
      availability_thursday: false,
      availability_friday: false,
      availability_saturday_am: false,
      availability_saturday_pm: false,
      availability_sunday_am: false,
      availability_sunday_pm: false,
      parents: [{ first_name: '', last_name: '', email: '', phone: null }],
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'parents',
  });

  const onSubmit: SubmitHandler<FormData> = async (formData: FormData) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    
    try {
      const studentData: TablesInsert<'students'> = {
        id: crypto.randomUUID(),
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.studentEmail || null,
        phone: formData.studentPhone || null,
        school: formData.school || null,
        curriculum: formData.curriculum || null,
        year_level: formData.yearLevel ?? null,
        status: formData.status,
        availability_monday: formData.availability_monday,
        availability_tuesday: formData.availability_tuesday,
        availability_wednesday: formData.availability_wednesday,
        availability_thursday: formData.availability_thursday,
        availability_friday: formData.availability_friday,
        availability_saturday_am: formData.availability_saturday_am,
        availability_saturday_pm: formData.availability_saturday_pm,
        availability_sunday_am: formData.availability_sunday_am,
        availability_sunday_pm: formData.availability_sunday_pm,
        created_at: null,
        created_by: null,
        invite_token: null,
        updated_at: null,
        user_id: null,
      };

      const createdStudent = await createStudentMutation.mutateAsync(studentData);
      
      // Assign selected subjects to the student
      if (selectedSubjects.length > 0 && createdStudent) {
        try {
          await Promise.all(
            selectedSubjects.map(subject => 
              studentsApi.assignSubjectToStudent(createdStudent.id, subject.id)
            )
          );
        } catch (subjectError) {
          console.error('Failed to assign some subjects:', subjectError);
          toast({
            title: "Warning",
            description: "Student created but some subjects could not be assigned.",
            variant: "default",
          });
        }
      }

      // Create and assign parents if provided
      if (formData.parents && formData.parents.length > 0 && createdStudent) {
        try {
          await Promise.all(
            formData.parents.map(async (parentData) => {
              // Only create parent if at least one field is filled in
              const hasAnyData =
                (parentData.first_name?.trim()) ||
                (parentData.last_name?.trim()) ||
                (parentData.email?.trim()) ||
                (parentData.phone && String(parentData.phone).trim());
              if (hasAnyData) {
                const parentDataToCreate: TablesInsert<'parents'> = {
                  id: crypto.randomUUID(),
                  first_name: parentData.first_name || '',
                  last_name: parentData.last_name || '',
                  email: parentData.email || null,
                  phone: parentData.phone || null,
                  created_at: null,
                  updated_at: null,
                };

                const createdParent = await createParentMutation.mutateAsync(parentDataToCreate);
                
                // Assign parent to student
                await studentsApi.assignStudentToParent(createdParent.id, createdStudent.id);
              }
            })
          );
          
          // Invalidate all-parents query to refresh parent lists
          queryClient.invalidateQueries({ queryKey: ['students', 'all-parents'] });
        } catch (parentError) {
          console.error('Failed to create/assign some parents:', parentError);
          toast({
            title: "Warning",
            description: "Student created but some parents could not be added.",
            variant: "default",
          });
        }
      }
      
      toast({
        title: "Success",
        description: "Student added successfully.",
      });
      
      // Reset form and close modal
      reset();
      setSelectedSubjects([]);
      setSubjectSearchQuery('');
      onStudentAdded();
      onClose();
    } catch (error) {
      console.error('Error adding student:', error);
      
      let errorMsg = 'An unknown error occurred';
      if (error instanceof Error) {
        errorMsg = error.message;
      }
      
      setErrorMessage(errorMsg);
      
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    if (!isSubmitting) {
      reset();
      setErrorMessage(null);
      setSelectedSubjects([]);
      setSubjectSearchQuery('');
      onClose();
    }
  };

  const handleAddParent = () => {
    append({ first_name: '', last_name: '', email: '', phone: null });
  };

  const handleAddSubject = (subjectId: string) => {
    const subject = allSubjects.find(s => s.id === subjectId);
    if (subject && !selectedSubjects.some(s => s.id === subjectId)) {
      setSelectedSubjects(prev => [...prev, subject]);
      setIsAddSubjectPopoverOpen(false);
      setSubjectSearchQuery('');
    }
  };

  const handleRemoveSubject = (subjectId: string) => {
    setSelectedSubjects(prev => prev.filter(s => s.id !== subjectId));
  };

  const availableSubjects = allSubjects.filter(subject => 
    !selectedSubjects.some(selected => selected.id === subject.id)
  );

  const filteredAvailableSubjects = availableSubjects.filter(subject => {
    if (!subjectSearchQuery) return true;
    const query = subjectSearchQuery.toLowerCase();
    return formatSubjectDisplay(subject).toLowerCase().includes(query);
  });

  return (
    <Dialog open={isOpen} onOpenChange={handleCloseModal}>
      <DialogContent className="w-full md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Student</DialogTitle>
          <DialogDescription>
            Enter the student's information below to add them to the system.
          </DialogDescription>
        </DialogHeader>
        
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
            <div className="text-sm text-red-600">{errorMessage}</div>
          </div>
        )}
        
        <form onSubmit={handleSubmit(onSubmit as SubmitHandler<FieldValues>)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input 
                id="firstName" 
                {...register('firstName')} 
                disabled={isSubmitting} 
              />
              {errors.firstName && (
                <p className="text-sm text-red-500">{errors.firstName.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input 
                id="lastName" 
                {...register('lastName')} 
                disabled={isSubmitting} 
              />
              {errors.lastName && (
                <p className="text-sm text-red-500">{errors.lastName.message}</p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="studentEmail">Student Email</Label>
              <Input 
                id="studentEmail" 
                type="email" 
                {...register('studentEmail')} 
                disabled={isSubmitting} 
              />
              {errors.studentEmail && (
                <p className="text-sm text-red-500">{errors.studentEmail.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="studentPhone">Student Phone</Label>
              <Controller
                control={control}
                name="studentPhone"
                render={({ field }) => (
                  <PhoneInput
                    value={field.value || ''}
                    onChange={field.onChange}
                    disabled={isSubmitting}
                    error={errors.studentPhone?.message}
                  />
                )}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="school">School</Label>
              <Input 
                id="school" 
                {...register('school')} 
                disabled={isSubmitting} 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="curriculum">Curriculum</Label>
              <Controller
                control={control}
                name="curriculum"
                render={({ field }) => (
                  <Select 
                    disabled={isSubmitting}
                    value={field.value || ''}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select curriculum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SACE">SACE</SelectItem>
                      <SelectItem value="IB">IB</SelectItem>
                      <SelectItem value="PRESACE">PRESACE</SelectItem>
                      <SelectItem value="PRIMARY">PRIMARY</SelectItem>
                      <SelectItem value="MEDICINE">MEDICINE</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="yearLevel">Year Level</Label>
              <Controller
                control={control}
                name="yearLevel"
                render={({ field }) => (
                  <Input
                    id="yearLevel"
                    type="number"
                    min="1"
                    max="12"
                    value={field.value ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      field.onChange(value === '' || value === null || value === undefined ? null : parseInt(value, 10));
                    }}
                    disabled={isSubmitting}
                  />
                )}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select 
                  disabled={isSubmitting}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={'TRIAL'}>Trial</SelectItem>
                    <SelectItem value={'ACTIVE'}>Active</SelectItem>
                    <SelectItem value={'INACTIVE'}>Inactive</SelectItem>
                    <SelectItem value={'DISCONTINUED'}>Discontinued</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.status && (
              <p className="text-sm text-red-500">{errors.status.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label>Subjects</Label>
            <div className="space-y-2">
              {selectedSubjects.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedSubjects.map((subject) => (
                    <Badge
                      key={subject.id}
                      variant="secondary"
                      className="flex items-center gap-1 pr-1"
                    >
                      <span>{formatSubjectDisplay(subject)}</span>
                      <button
                        type="button"
                        className="ml-1 rounded-full hover:bg-black/20 p-0.5 flex items-center justify-center"
                        onClick={() => handleRemoveSubject(subject.id)}
                        disabled={isSubmitting}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <Popover open={isAddSubjectPopoverOpen} onOpenChange={setIsAddSubjectPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm" 
                    className="flex items-center gap-2"
                    disabled={isSubmitting}
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Subject</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[300px]" align="start">
                  <div className="p-3">
                    <Input
                      placeholder="Search subjects..."
                      value={subjectSearchQuery}
                      onChange={(e) => setSubjectSearchQuery(e.target.value)}
                      className="mb-3"
                    />
                    <ScrollArea className="max-h-[300px]">
                      <div className="space-y-1">
                        {filteredAvailableSubjects.length === 0 ? (
                          <div className="p-3 text-center text-sm text-muted-foreground">
                            {subjectSearchQuery ? 'No subjects match your search' : 'No available subjects found'}
                          </div>
                        ) : (
                          filteredAvailableSubjects.map(subject => (
                            <Button
                              key={subject.id}
                              type="button"
                              variant="ghost"
                              className="w-full justify-start h-auto p-2"
                              onClick={() => handleAddSubject(subject.id)}
                            >
                              <div className="flex items-center justify-between w-full">
                                <div className="flex flex-col items-start">
                                  <div className="font-medium">{formatSubjectDisplay(subject)}</div>
                                </div>
                              </div>
                            </Button>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Parents Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Parents (Optional)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddParent}
                disabled={isSubmitting}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Parent
              </Button>
            </div>
            
            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">No parents added</p>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Parent {index + 1}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        disabled={isSubmitting}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`parent-${index}-firstName`}>First Name</Label>
                        <Input
                          id={`parent-${index}-firstName`}
                          {...register(`parents.${index}.first_name`)}
                          disabled={isSubmitting}
                        />
                        {errors.parents?.[index]?.first_name && (
                          <p className="text-sm text-red-500">
                            {errors.parents[index]?.first_name?.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`parent-${index}-lastName`}>Last Name</Label>
                        <Input
                          id={`parent-${index}-lastName`}
                          {...register(`parents.${index}.last_name`)}
                          disabled={isSubmitting}
                        />
                        {errors.parents?.[index]?.last_name && (
                          <p className="text-sm text-red-500">
                            {errors.parents[index]?.last_name?.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`parent-${index}-email`}>Email</Label>
                        <Input
                          id={`parent-${index}-email`}
                          type="email"
                          {...register(`parents.${index}.email`)}
                          disabled={isSubmitting}
                        />
                        {errors.parents?.[index]?.email && (
                          <p className="text-sm text-red-500">
                            {errors.parents[index]?.email?.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`parent-${index}-phone`}>Phone</Label>
                        <Controller
                          control={control}
                          name={`parents.${index}.phone`}
                          render={({ field }) => (
                            <PhoneInput
                              value={field.value || ''}
                              onChange={field.onChange}
                              disabled={isSubmitting}
                              error={errors.parents?.[index]?.phone?.message}
                            />
                          )}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label>Availability</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center space-x-2">
                <Controller
                  control={control}
                  name="availability_monday"
                  render={({ field }) => (
                    <Checkbox 
                      id="availability_monday" 
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  )}
                />
                <Label htmlFor="availability_monday">Monday</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Controller
                  control={control}
                  name="availability_tuesday"
                  render={({ field }) => (
                    <Checkbox 
                      id="availability_tuesday" 
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  )}
                />
                <Label htmlFor="availability_tuesday">Tuesday</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Controller
                  control={control}
                  name="availability_wednesday"
                  render={({ field }) => (
                    <Checkbox 
                      id="availability_wednesday" 
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  )}
                />
                <Label htmlFor="availability_wednesday">Wednesday</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Controller
                  control={control}
                  name="availability_thursday"
                  render={({ field }) => (
                    <Checkbox 
                      id="availability_thursday" 
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  )}
                />
                <Label htmlFor="availability_thursday">Thursday</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Controller
                  control={control}
                  name="availability_friday"
                  render={({ field }) => (
                    <Checkbox 
                      id="availability_friday" 
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  )}
                />
                <Label htmlFor="availability_friday">Friday</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Controller
                  control={control}
                  name="availability_saturday_am"
                  render={({ field }) => (
                    <Checkbox 
                      id="availability_saturday_am" 
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  )}
                />
                <Label htmlFor="availability_saturday_am">Saturday AM</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Controller
                  control={control}
                  name="availability_saturday_pm"
                  render={({ field }) => (
                    <Checkbox 
                      id="availability_saturday_pm" 
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  )}
                />
                <Label htmlFor="availability_saturday_pm">Saturday PM</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Controller
                  control={control}
                  name="availability_sunday_am"
                  render={({ field }) => (
                    <Checkbox 
                      id="availability_sunday_am" 
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  )}
                />
                <Label htmlFor="availability_sunday_am">Sunday AM</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Controller
                  control={control}
                  name="availability_sunday_pm"
                  render={({ field }) => (
                    <Checkbox 
                      id="availability_sunday_pm" 
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  )}
                />
                <Label htmlFor="availability_sunday_pm">Sunday PM</Label>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseModal}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Student'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
