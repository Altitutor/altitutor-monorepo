'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2, Pencil, Trash2 } from 'lucide-react';
import { staffApi } from '@/lib/supabase/api';
import { Staff, StaffRole, StaffStatus } from '@/lib/supabase/db/types';
import { useRouter } from 'next/navigation';
import { useToast } from "@/components/ui/use-toast";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Separator } from "@/components/ui/separator";

export interface ViewStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffId: string | null;
  onStaffUpdated?: () => void;
}

// Form schema for staff details with all availability fields required
const formSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phoneNumber: z
    .string()
    .regex(/^\+?[0-9]{10,14}$/, 'Invalid phone number format')
    .optional()
    .nullish(),
  role: z.nativeEnum(StaffRole),
  status: z.nativeEnum(StaffStatus),
  
  // Availability checkboxes - must be required in the schema
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

const getRoleBadgeColor = (role: StaffRole) => {
  switch (role) {
    case StaffRole.ADMIN:
      return 'bg-purple-100 text-purple-800';
    case StaffRole.TUTOR:
      return 'bg-blue-100 text-blue-800';
    case StaffRole.ADMINSTAFF:
      return 'bg-indigo-100 text-indigo-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusBadgeColor = (status: StaffStatus) => {
  switch (status) {
    case StaffStatus.ACTIVE:
      return 'bg-green-100 text-green-800';
    case StaffStatus.INACTIVE:
      return 'bg-gray-100 text-gray-800';
    case StaffStatus.TRIAL:
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export function ViewStaffModal({ isOpen, onClose, staffId, onStaffUpdated }: ViewStaffModalProps) {
  const [staffMember, setStaffMember] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  
  // Initialize form
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      role: StaffRole.TUTOR,
      status: StaffStatus.ACTIVE,
      availability_monday: false,
      availability_tuesday: false,
      availability_wednesday: false,
      availability_thursday: false,
      availability_friday: false,
      availability_saturday_am: false,
      availability_saturday_pm: false,
      availability_sunday_am: false,
      availability_sunday_pm: false,
    },
  });

  // Load staff when modal opens
  useEffect(() => {
    if (isOpen && staffId) {
      loadStaff(staffId);
    } else {
      setStaffMember(null);
      setError(null);
      setIsEditing(false);
    }
  }, [isOpen, staffId]);

  // Update form values when staff is loaded
  useEffect(() => {
    if (staffMember) {
      console.log("Setting form values from staff member:", staffMember);
      form.reset({
        firstName: staffMember.firstName || '',
        lastName: staffMember.lastName || '',
        email: staffMember.email || '',
        phoneNumber: staffMember.phoneNumber || '',
        role: staffMember.role,
        status: staffMember.status,
        availability_monday: staffMember.availabilityMonday || false,
        availability_tuesday: staffMember.availabilityTuesday || false,
        availability_wednesday: staffMember.availabilityWednesday || false,
        availability_thursday: staffMember.availabilityThursday || false,
        availability_friday: staffMember.availabilityFriday || false,
        availability_saturday_am: staffMember.availabilitySaturdayAm || false,
        availability_saturday_pm: staffMember.availabilitySaturdayPm || false,
        availability_sunday_am: staffMember.availabilitySundayAm || false,
        availability_sunday_pm: staffMember.availabilitySundayPm || false,
      });
    }
  }, [staffMember, form]);

  // Load staff data
  const loadStaff = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await staffApi.getStaff(id);
      if (data) {
        console.log("Loaded staff member:", data);
        setStaffMember(data);
      } else {
        setError('Staff member not found.');
      }
    } catch (err) {
      console.error('Failed to load staff member:', err);
      setError('Failed to load staff member details.');
    } finally {
      setLoading(false);
    }
  };

  // Handle edit button click
  const handleEditClick = () => {
    setIsEditing(true);
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    if (staffMember) {
      form.reset({
        firstName: staffMember.firstName || '',
        lastName: staffMember.lastName || '',
        email: staffMember.email || '',
        phoneNumber: staffMember.phoneNumber || '',
        role: staffMember.role,
        status: staffMember.status,
        availability_monday: staffMember.availabilityMonday || false,
        availability_tuesday: staffMember.availabilityTuesday || false,
        availability_wednesday: staffMember.availabilityWednesday || false,
        availability_thursday: staffMember.availabilityThursday || false,
        availability_friday: staffMember.availabilityFriday || false,
        availability_saturday_am: staffMember.availabilitySaturdayAm || false,
        availability_saturday_pm: staffMember.availabilitySaturdayPm || false,
        availability_sunday_am: staffMember.availabilitySundayAm || false,
        availability_sunday_pm: staffMember.availabilitySundayPm || false,
      });
    }
    setIsEditing(false);
  };

  // Handle form submission
  const onSubmit: SubmitHandler<FormData> = async (values) => {
    if (!staffMember) return;
    
    try {
      setLoading(true);
      const updatedData: Partial<Staff> = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phoneNumber: values.phoneNumber || null,
        role: values.role,
        status: values.status,
        availabilityMonday: values.availability_monday,
        availabilityTuesday: values.availability_tuesday,
        availabilityWednesday: values.availability_wednesday,
        availabilityThursday: values.availability_thursday,
        availabilityFriday: values.availability_friday,
        availabilitySaturdayAm: values.availability_saturday_am,
        availabilitySaturdayPm: values.availability_saturday_pm,
        availabilitySundayAm: values.availability_sunday_am,
        availabilitySundayPm: values.availability_sunday_pm,
      };
      
      await staffApi.updateStaff(staffMember.id, updatedData);
      
      const updatedStaff = {
        ...staffMember,
        ...updatedData,
      };
      
      setStaffMember(updatedStaff);
      setIsEditing(false);
      
      toast({
        title: "Staff updated",
        description: `${updatedStaff.firstName} ${updatedStaff.lastName} has been updated successfully.`,
      });
      
      if (onStaffUpdated) {
        onStaffUpdated();
      }
    } catch (err) {
      console.error('Failed to update staff:', err);
      toast({
        title: "Update failed",
        description: "There was an error updating the staff member. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle delete
  const handleDeleteStaff = async () => {
    if (!staffMember) return;
    
    try {
      setIsDeleting(true);
      await staffApi.deleteStaff(staffMember.id);
      
      toast({
        title: "Staff deleted",
        description: `${staffMember.firstName} ${staffMember.lastName} has been deleted successfully.`,
      });
      
      onClose();
      
      if (onStaffUpdated) {
        onStaffUpdated();
      }
    } catch (err) {
      console.error('Failed to delete staff:', err);
      toast({
        title: "Delete failed",
        description: "There was an error deleting the staff member. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(isOpen) => {
      if (!isOpen) onClose();
    }}>
      <SheetContent className="h-full max-h-[100vh] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl">
            {loading ? 'Staff Member' : isEditing ? 'Edit Staff Member' : 'Staff Member'}
          </SheetTitle>
          {!loading && staffMember && (
            <SheetDescription className="text-lg font-medium">
              {staffMember.firstName} {staffMember.lastName}
            </SheetDescription>
          )}
        </SheetHeader>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading staff details...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-8 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold">Error Loading Staff</h3>
            <p className="text-muted-foreground">{error}</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => staffId && loadStaff(staffId)}
            >
              Try Again
            </Button>
          </div>
        ) : staffMember ? (
          <div className="space-y-8">
            {isEditing ? (
              // Edit Mode
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input 
                      id="firstName" 
                      {...form.register('firstName')} 
                      disabled={loading} 
                    />
                    {form.formState.errors.firstName && (
                      <p className="text-sm text-red-500">{form.formState.errors.firstName.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input 
                      id="lastName" 
                      {...form.register('lastName')} 
                      disabled={loading} 
                    />
                    {form.formState.errors.lastName && (
                      <p className="text-sm text-red-500">{form.formState.errors.lastName.message}</p>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    {...form.register('email')} 
                    disabled={loading} 
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input 
                    id="phoneNumber" 
                    {...form.register('phoneNumber')} 
                    disabled={loading} 
                    placeholder="e.g. +12345678901"
                  />
                  {form.formState.errors.phoneNumber && (
                    <p className="text-sm text-red-500">{form.formState.errors.phoneNumber.message}</p>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Controller
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <Select 
                          disabled={loading}
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
                    {form.formState.errors.role && (
                      <p className="text-sm text-red-500">{form.formState.errors.role.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Controller
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <Select 
                          disabled={loading}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={StaffStatus.ACTIVE}>Active</SelectItem>
                            <SelectItem value={StaffStatus.INACTIVE}>Inactive</SelectItem>
                            <SelectItem value={StaffStatus.TRIAL}>Trial</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {form.formState.errors.status && (
                      <p className="text-sm text-red-500">{form.formState.errors.status.message}</p>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Availability</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center space-x-2">
                      <Controller
                        control={form.control}
                        name="availability_monday"
                        render={({ field }) => (
                          <Checkbox 
                            id="availability_monday" 
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={loading}
                          />
                        )}
                      />
                      <Label htmlFor="availability_monday">Monday</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Controller
                        control={form.control}
                        name="availability_tuesday"
                        render={({ field }) => (
                          <Checkbox 
                            id="availability_tuesday" 
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={loading}
                          />
                        )}
                      />
                      <Label htmlFor="availability_tuesday">Tuesday</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Controller
                        control={form.control}
                        name="availability_wednesday"
                        render={({ field }) => (
                          <Checkbox 
                            id="availability_wednesday" 
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={loading}
                          />
                        )}
                      />
                      <Label htmlFor="availability_wednesday">Wednesday</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Controller
                        control={form.control}
                        name="availability_thursday"
                        render={({ field }) => (
                          <Checkbox 
                            id="availability_thursday" 
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={loading}
                          />
                        )}
                      />
                      <Label htmlFor="availability_thursday">Thursday</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Controller
                        control={form.control}
                        name="availability_friday"
                        render={({ field }) => (
                          <Checkbox 
                            id="availability_friday" 
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={loading}
                          />
                        )}
                      />
                      <Label htmlFor="availability_friday">Friday</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Controller
                        control={form.control}
                        name="availability_saturday_am"
                        render={({ field }) => (
                          <Checkbox 
                            id="availability_saturday_am" 
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={loading}
                          />
                        )}
                      />
                      <Label htmlFor="availability_saturday_am">Saturday AM</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Controller
                        control={form.control}
                        name="availability_saturday_pm"
                        render={({ field }) => (
                          <Checkbox 
                            id="availability_saturday_pm" 
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={loading}
                          />
                        )}
                      />
                      <Label htmlFor="availability_saturday_pm">Saturday PM</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Controller
                        control={form.control}
                        name="availability_sunday_am"
                        render={({ field }) => (
                          <Checkbox 
                            id="availability_sunday_am" 
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={loading}
                          />
                        )}
                      />
                      <Label htmlFor="availability_sunday_am">Sunday AM</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Controller
                        control={form.control}
                        name="availability_sunday_pm"
                        render={({ field }) => (
                          <Checkbox 
                            id="availability_sunday_pm" 
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={loading}
                          />
                        )}
                      />
                      <Label htmlFor="availability_sunday_pm">Sunday PM</Label>
                    </div>
                  </div>
                </div>
              </form>
            ) : (
              // View Mode
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div className="text-sm font-medium">First Name:</div>
                  <div>{staffMember.firstName || '-'}</div>
                  
                  <div className="text-sm font-medium">Last Name:</div>
                  <div>{staffMember.lastName || '-'}</div>
                  
                  <div className="text-sm font-medium">Email:</div>
                  <div>{staffMember.email || '-'}</div>
                  
                  <div className="text-sm font-medium">Phone Number:</div>
                  <div>{staffMember.phoneNumber || '-'}</div>
                  
                  <div className="text-sm font-medium">Role:</div>
                  <div>
                    <Badge className={getRoleBadgeColor(staffMember.role)}>
                      {staffMember.role}
                    </Badge>
                  </div>
                  
                  <div className="text-sm font-medium">Status:</div>
                  <div>
                    <Badge className={getStatusBadgeColor(staffMember.status)}>
                      {staffMember.status}
                    </Badge>
                  </div>
                  
                  <div className="text-sm font-medium">Created:</div>
                  <div>{new Date(staffMember.created_at).toLocaleDateString()}</div>
                </div>
                
                <Separator className="my-4" />
                
                <div>
                  <h3 className="text-sm font-medium mb-3">Availability</h3>
                  <div className="grid grid-cols-3 gap-y-2">
                    {staffMember.availabilityMonday && (
                      <span className="text-sm">Monday</span>
                    )}
                    {staffMember.availabilityTuesday && (
                      <span className="text-sm">Tuesday</span>
                    )}
                    {staffMember.availabilityWednesday && (
                      <span className="text-sm">Wednesday</span>
                    )}
                    {staffMember.availabilityThursday && (
                      <span className="text-sm">Thursday</span>
                    )}
                    {staffMember.availabilityFriday && (
                      <span className="text-sm">Friday</span>
                    )}
                    {staffMember.availabilitySaturdayAm && (
                      <span className="text-sm">Saturday AM</span>
                    )}
                    {staffMember.availabilitySaturdayPm && (
                      <span className="text-sm">Saturday PM</span>
                    )}
                    {staffMember.availabilitySundayAm && (
                      <span className="text-sm">Sunday AM</span>
                    )}
                    {staffMember.availabilitySundayPm && (
                      <span className="text-sm">Sunday PM</span>
                    )}
                    {![
                      staffMember.availabilityMonday,
                      staffMember.availabilityTuesday,
                      staffMember.availabilityWednesday,
                      staffMember.availabilityThursday,
                      staffMember.availabilityFriday,
                      staffMember.availabilitySaturdayAm,
                      staffMember.availabilitySaturdayPm,
                      staffMember.availabilitySundayAm,
                      staffMember.availabilitySundayPm
                    ].some(Boolean) && (
                      <span className="text-sm text-muted-foreground">No availability set</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Action buttons at the bottom */}
        {!loading && staffMember && (
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
                          This will permanently delete the staff member
                          "{staffMember.firstName || ''} {staffMember.lastName || ''}" and their user account.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDeleteStaff}
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