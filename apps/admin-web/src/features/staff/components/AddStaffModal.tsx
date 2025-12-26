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
import { useInviteStaff } from '../hooks/useStaffQuery';
// Use string literals for role/status
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, AlertTriangle } from 'lucide-react';

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
    .string()
    .regex(/^\+?[0-9]{10,14}$/, 'Invalid phone number format')
    .optional()
    .nullable(),
  role: z.enum(['TUTOR','ADMINSTAFF']),
  
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
});

type FormData = z.infer<typeof formSchema>;

export function AddStaffModal({ isOpen, onClose, onStaffAdded }: AddStaffModalProps) {
  const { toast } = useToast();
  const inviteStaffMutation = useInviteStaff();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const { 
    control, 
    register, 
    handleSubmit, 
    reset,
    formState: { errors } 
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      role: 'TUTOR',
      availability_monday: false,
      availability_tuesday: false,
      availability_wednesday: false,
      availability_thursday: false,
      availability_friday: false,
      availability_saturday_am: false,
      availability_saturday_pm: false,
      availability_sunday_am: false,
      availability_sunday_pm: false,
    }
  });

  const onSubmit: SubmitHandler<FormData> = async (formData) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    
    try {
      const staffData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email || undefined,
        phone_number: formData.phoneNumber || null,
        role: formData.role,
        status: 'ACTIVE' as const,
        availability_monday: formData.availability_monday,
        availability_tuesday: formData.availability_tuesday,
        availability_wednesday: formData.availability_wednesday,
        availability_thursday: formData.availability_thursday,
        availability_friday: formData.availability_friday,
        availability_saturday_am: formData.availability_saturday_am,
        availability_saturday_pm: formData.availability_saturday_pm,
        availability_sunday_am: formData.availability_sunday_am,
        availability_sunday_pm: formData.availability_sunday_pm,
      };
      
      // Create the staff member with user account using invitation
      await inviteStaffMutation.mutateAsync(staffData);
      
      toast({
        title: 'Staff added successfully',
        description: 'An invitation email has been sent with instructions to set up their account.',
      });
      
      // Reset form and close modal
      reset();
      onStaffAdded();
      onClose();
    } catch (error) {
      console.error('Error adding staff:', error);
      
      let errorMsg = 'An unknown error occurred';
      if (error instanceof Error) {
        errorMsg = error.message;
        
        // Check for specific Supabase errors
        if (errorMsg.includes('User already registered')) {
          errorMsg = 'A user with this email already exists';
        } else if (errorMsg.includes('not allowed')) {
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
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCloseModal}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                'Add Staff Member'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 