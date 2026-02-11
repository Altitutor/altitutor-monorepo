'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { Checkbox } from '@altitutor/ui';
import { PhoneInput } from '@altitutor/ui';
import { useToast } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { useCreateStaff } from '../hooks/useStaffQuery';
import { useSubjects } from '@/features/subjects/hooks/useSubjectsQuery';
import { useAssignSubjectToStaff } from '../hooks/useStaffQuery';
import { formatSubjectDisplay } from '@/shared/utils';
// Use string literals for role/status
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, AlertTriangle, Plus, X } from 'lucide-react';
import type { Tables } from '@altitutor/shared';

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStaffAdded: () => void;
}

// Schema for form validation
const formSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phoneNumber: z
    .union([
      z.string().regex(/^\+?[0-9]{10,14}$/, 'Invalid phone number format'),
      z.literal(''),
      z.null()
    ])
    .transform((val) => val === '' ? null : val)
    .optional()
    .nullable(),
  role: z.enum(['TUTOR','ADMINSTAFF']),
  status: z.enum(['ACTIVE','INACTIVE','TRIAL']),
  officeKeyNumber: z.union([
    z.number().int().positive(),
    z.string().regex(/^\d+$/).transform(Number),
    z.literal('').transform(() => null),
    z.null()
  ]).optional(),
  hasParkingRemote: z.enum(['VIRTUAL', 'PHYSICAL', 'NONE']).nullable().optional(),
  
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
  // Session-type availability
  drafting_availability: z.boolean(),
  trial_session_availability: z.boolean(),
  subsidy_interview_availability: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

export function AddStaffModal({ isOpen, onClose, onStaffAdded }: AddStaffModalProps) {
  const { toast } = useToast();
  const createStaffMutation = useCreateStaff();
  const assignSubjectMutation = useAssignSubjectToStaff();
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
      email: '',
      phoneNumber: '',
      role: 'TUTOR',
      status: 'ACTIVE',
      officeKeyNumber: null,
      hasParkingRemote: 'NONE',
      availability_monday: false,
      availability_tuesday: false,
      availability_wednesday: false,
      availability_thursday: false,
      availability_friday: false,
      availability_saturday_am: false,
      availability_saturday_pm: false,
      availability_sunday_am: false,
      availability_sunday_pm: false,
      drafting_availability: false,
      trial_session_availability: false,
      subsidy_interview_availability: false,
    }
  });

  const onSubmit: SubmitHandler<FormData> = async (formData: FormData) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    
    try {
      const staffData: any = {
        id: crypto.randomUUID(),
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: (formData.email || null) as any,
        phone_number: formData.phoneNumber || null,
        role: formData.role,
        status: formData.status,
        office_key_number: formData.officeKeyNumber || null,
        has_parking_remote: formData.hasParkingRemote || 'NONE',
        availability_monday: formData.availability_monday,
        availability_tuesday: formData.availability_tuesday,
        availability_wednesday: formData.availability_wednesday,
        availability_thursday: formData.availability_thursday,
        availability_friday: formData.availability_friday,
        availability_saturday_am: formData.availability_saturday_am,
        availability_saturday_pm: formData.availability_saturday_pm,
        availability_sunday_am: formData.availability_sunday_am,
        availability_sunday_pm: formData.availability_sunday_pm,
        drafting_availability: formData.drafting_availability,
        trial_session_availability: formData.trial_session_availability,
        subsidy_interview_availability: formData.subsidy_interview_availability,
        user_id: null,
      };
      
      // Create the staff member without creating a user account
      const createdStaff = await createStaffMutation.mutateAsync(staffData);
      const staffId = createdStaff.id;
      
      // Assign subjects if any were selected (in parallel for better performance)
      if (selectedSubjects.length > 0) {
        try {
          await Promise.all(
            selectedSubjects.map(subject =>
              assignSubjectMutation.mutateAsync({
                staffId,
                subjectId: subject.id,
              })
            )
          );
        } catch (subjectError) {
          console.error('Failed to assign some subjects:', subjectError);
          toast({
            title: "Warning",
            description: "Staff member created but some subjects could not be assigned.",
            variant: "default",
          });
        }
      }
      
      toast({
        title: 'Staff added successfully',
        description: 'Staff member has been added to the system.',
      });
      
      // Reset form and close modal
      reset();
      setSelectedSubjects([]);
      setSubjectSearchQuery('');
      onStaffAdded();
      onClose();
    } catch (error) {
      console.error('Error adding staff:', error);
      
      let errorMsg = 'An unknown error occurred';
      if (error instanceof Error) {
        errorMsg = error.message;
        
        // Check for specific Supabase errors
        if (errorMsg.includes('not allowed')) {
          errorMsg = 'You do not have permission to add staff members';
        }
      }
      
      setErrorMessage(errorMsg);
      
      toast({
        title: 'Error adding staff',
        description: errorMsg,
        variant: 'destructive',
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
          <DialogTitle>Add New Staff Member</DialogTitle>
          <DialogDescription>
            Enter the staff member's information below to add them to the system.
          </DialogDescription>
        </DialogHeader>
        
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
            <div className="text-sm text-red-600">{errorMessage}</div>
          </div>
        )}
        
        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
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
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              {...register('email')} 
              disabled={isSubmitting} 
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Controller
              control={control}
              name="phoneNumber"
              render={({ field }) => (
                <PhoneInput
                  value={field.value || ''}
                  onChange={field.onChange}
                  disabled={isSubmitting}
                  error={errors.phoneNumber?.message}
                />
              )}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select 
                    disabled={isSubmitting}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={'TUTOR'}>Tutor</SelectItem>
                      <SelectItem value={'ADMINSTAFF'}>Admin Staff</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.role && (
                <p className="text-sm text-red-500">{errors.role.message}</p>
              )}
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
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={'ACTIVE'}>Active</SelectItem>
                      <SelectItem value={'INACTIVE'}>Inactive</SelectItem>
                      <SelectItem value={'TRIAL'}>Trial</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.status && (
                <p className="text-sm text-red-500">{errors.status.message}</p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hasParkingRemote">Parking Remote</Label>
              <Controller
                control={control}
                name="hasParkingRemote"
                render={({ field }) => (
                  <Select 
                    disabled={isSubmitting}
                    value={field.value || 'NONE'}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VIRTUAL">Virtual</SelectItem>
                      <SelectItem value="PHYSICAL">Physical</SelectItem>
                      <SelectItem value="NONE">None</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.hasParkingRemote && (
                <p className="text-sm text-red-500">{errors.hasParkingRemote.message}</p>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="officeKeyNumber">Office Key Number</Label>
            <Controller
              control={control}
              name="officeKeyNumber"
              render={({ field }) => (
                <Input
                  id="officeKeyNumber"
                  type="number"
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    field.onChange(value === '' || value === null || value === undefined ? null : parseInt(value, 10));
                  }}
                  disabled={isSubmitting}
                  placeholder="Enter key number"
                />
              )}
            />
            {errors.officeKeyNumber && (
              <p className="text-sm text-red-500">{errors.officeKeyNumber.message}</p>
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
          
          <div className="space-y-2">
            <Label>Session-Type Availability</Label>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center space-x-2">
                <Controller
                  control={control}
                  name="drafting_availability"
                  render={({ field }) => (
                    <Checkbox 
                      id="drafting_availability" 
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  )}
                />
                <Label htmlFor="drafting_availability">Available for Drafting Sessions</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Controller
                  control={control}
                  name="trial_session_availability"
                  render={({ field }) => (
                    <Checkbox 
                      id="trial_session_availability" 
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  )}
                />
                <Label htmlFor="trial_session_availability">Available for Trial Sessions</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Controller
                  control={control}
                  name="subsidy_interview_availability"
                  render={({ field }) => (
                    <Checkbox 
                      id="subsidy_interview_availability" 
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  )}
                />
                <Label htmlFor="subsidy_interview_availability">Available for Subsidy Interviews</Label>
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
                'Add Staff Member'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 