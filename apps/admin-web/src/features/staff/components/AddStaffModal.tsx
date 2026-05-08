'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { SearchableSelect } from '@altitutor/ui';
import { Checkbox } from '@altitutor/ui';
import { PhoneInput } from '@altitutor/ui';
import { useToast } from '@altitutor/ui';
import { SubjectSearchPopover } from '@/features/subjects/components/SubjectSearchPopover';
import { Badge } from '@altitutor/ui';
import { useCreateStaff } from '../hooks/useStaffQuery';
import { useAssignSubjectToStaff } from '../hooks/useStaffQuery';
// Use string literals for role/status
import { useForm, Controller, SubmitHandler, type FieldValues, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, AlertTriangle, Plus, X } from 'lucide-react';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';
import type { Tables, TablesInsert } from '@altitutor/shared';
import { showEntityCreatedToast } from '@/shared/utils';

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStaffAdded: () => void;
  initialPhone?: string | null;
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

export function AddStaffModal({ isOpen, onClose, onStaffAdded, initialPhone }: AddStaffModalProps) {
  const { toast } = useToast();
  const router = useRouter();
  const createStaffMutation = useCreateStaff();
  const assignSubjectMutation = useAssignSubjectToStaff();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<Tables<'subjects'>[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);

  const { 
    control, 
    register, 
    handleSubmit, 
    reset,
    setValue,
    formState: { errors } 
  } = useForm<FormData>({
    resolver: zodResolver(formSchema) as Resolver<FormData>,
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
      const staffData: TablesInsert<'staff'> = {
        id: crypto.randomUUID(),
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email || null,
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
      
      if (createdStaff?.id) {
        showEntityCreatedToast({
          toast,
          router,
          entityType: 'staff',
          entityId: createdStaff.id,
          message: 'Staff member has been added to the system.',
        });
      } else {
        toast({
          title: 'Staff added successfully',
          description: 'Staff member has been added to the system.',
        });
      }
      
      // Reset form and close modal
      reset();
      setSelectedSubjects([]);
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
      onClose();
    }
  };

  const handleAddSubject = (subject: Tables<'subjects'>) => {
    if (!selectedSubjects.some(s => s.id === subject.id)) {
      setSelectedSubjects(prev => [...prev, subject]);
    }
  };

  const handleRemoveSubject = (subjectId: string) => {
    setSelectedSubjects(prev => prev.filter(s => s.id !== subjectId));
  };

  useEffect(() => {
    if (!isOpen) return;
    setValue('phoneNumber', initialPhone || '');
  }, [initialPhone, isOpen, setValue]);

  return (
    <Dialog open={isOpen} onOpenChange={handleCloseModal}>
      <DialogContent
        className={cn(
          'w-full md:max-w-2xl max-h-[90vh] overflow-y-auto',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle>Add New Staff Member</DialogTitle>
              <DialogDescription>
                Enter the staff member's information below to add them to the system.
              </DialogDescription>
            </div>
            <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
          </div>
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
                render={({ field }) => {
                  const ROLE_OPTIONS = [
                    { value: 'TUTOR' as const, label: 'Tutor' },
                    { value: 'ADMINSTAFF' as const, label: 'Admin Staff' },
                  ];
                  const selected = ROLE_OPTIONS.find((o) => o.value === field.value) ?? null;
                  return (
                    <SearchableSelect<typeof ROLE_OPTIONS[number]>
                      items={ROLE_OPTIONS}
                      value={selected}
                      onValueChange={(item) => field.onChange(item?.value)}
                      getItemLabel={(o) => o.label}
                      getItemId={(o) => o.value}
                      placeholder="Select role"
                      disabled={isSubmitting}
                    />
                  );
                }}
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
                render={({ field }) => {
                  const STATUS_OPTIONS = [
                    { value: 'ACTIVE' as const, label: 'Active' },
                    { value: 'INACTIVE' as const, label: 'Inactive' },
                    { value: 'TRIAL' as const, label: 'Trial' },
                  ];
                  const selected = STATUS_OPTIONS.find((o) => o.value === field.value) ?? null;
                  return (
                    <SearchableSelect<typeof STATUS_OPTIONS[number]>
                      items={STATUS_OPTIONS}
                      value={selected}
                      onValueChange={(item) => field.onChange(item?.value)}
                      getItemLabel={(o) => o.label}
                      getItemId={(o) => o.value}
                      placeholder="Select status"
                      disabled={isSubmitting}
                    />
                  );
                }}
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
                render={({ field }) => {
                  const PARKING_OPTIONS = [
                    { value: 'VIRTUAL' as const, label: 'Virtual' },
                    { value: 'PHYSICAL' as const, label: 'Physical' },
                    { value: 'NONE' as const, label: 'None' },
                  ];
                  const effectiveValue = field.value || 'NONE';
                  const selected = PARKING_OPTIONS.find((o) => o.value === effectiveValue) ?? null;
                  return (
                    <SearchableSelect<typeof PARKING_OPTIONS[number]>
                      items={PARKING_OPTIONS}
                      value={selected}
                      onValueChange={(item) => field.onChange(item?.value)}
                      getItemLabel={(o) => o.label}
                      getItemId={(o) => o.value}
                      placeholder="Select option"
                      disabled={isSubmitting}
                    />
                  );
                }}
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
                      <span>{(subject?.long_name ?? '')}</span>
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
              <SubjectSearchPopover
                selectedSubjects={selectedSubjects}
                onSelectSubject={handleAddSubject}
                trigger={
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
                }
                align="start"
              />
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