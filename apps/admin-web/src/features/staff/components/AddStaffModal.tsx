'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { useInviteStaff } from '../hooks/useStaffQuery';
import { Staff, StaffRole, StaffStatus } from '../types';
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
  role: z.nativeEnum(StaffRole),
  
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
      role: StaffRole.TUTOR,
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
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        role: formData.role,
        status: StaffStatus.ACTIVE,
        availabilityMonday: formData.availability_monday,
        availabilityTuesday: formData.availability_tuesday,
        availabilityWednesday: formData.availability_wednesday,
        availabilityThursday: formData.availability_thursday,
        availabilityFriday: formData.availability_friday,
        availabilitySaturdayAm: formData.availability_saturday_am,
        availabilitySaturdayPm: formData.availability_saturday_pm,
        availabilitySundayAm: formData.availability_sunday_am,
        availabilitySundayPm: formData.availability_sunday_pm,
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
    reset();
    setErrorMessage(null);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleCloseModal}>
      <SheetContent className="h-full max-h-[100vh] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl">Add New Staff Member</SheetTitle>
        </SheetHeader>
        
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
            <div className="text-sm text-red-600">{errorMessage}</div>
          </div>
        )}
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-20">
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
            <Input 
              id="phoneNumber" 
              {...register('phoneNumber')} 
              disabled={isSubmitting} 
              placeholder="e.g. +12345678901"
            />
            {errors.phoneNumber && (
              <p className="text-sm text-red-500">{errors.phoneNumber.message}</p>
            )}
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
                    <SelectItem value={StaffRole.TUTOR}>Tutor</SelectItem>
                    <SelectItem value={StaffRole.ADMINSTAFF}>Admin Staff</SelectItem>
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
        </form>
        
        {/* Action buttons at the bottom */}
        <SheetFooter className="absolute bottom-0 left-0 right-0 p-6 border-t bg-background">
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" type="button" onClick={handleCloseModal} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              type="button" 
              disabled={isSubmitting}
              onClick={handleSubmit(onSubmit)}
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
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
} 