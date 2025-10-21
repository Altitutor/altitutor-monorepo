import { useState } from 'react';
import type { Tables } from '@altitutor/shared';
import { Badge } from "@/components/ui/badge";
import { StaffRoleBadge, StaffStatusBadge, BooleanBadge } from "@/components/ui/enum-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Pencil } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Form schema for staff details
const formSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phoneNumber: z
    .string()
    .regex(/^\+?[0-9]{10,14}$/, 'Invalid phone number format')
    .optional()
    .nullish(),
  role: z.enum(['TUTOR','ADMINSTAFF']),
  status: z.enum(['ACTIVE','INACTIVE','TRIAL']),
  officeKeyNumber: z.union([
    z.number().int().positive(),
    z.string().regex(/^\d+$/).transform(Number),
    z.literal('').transform(() => null),
    z.null()
  ]).optional(),
  hasParkingRemote: z.enum(['VIRTUAL', 'PHYSICAL', 'NONE']).nullable().optional(),
  
  // Availability checkboxes
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

interface StaffDetailsTabProps {
  staffMember: Tables<'staff'>;
  isEditing: boolean;
  isLoading: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSubmit: (data: FormData) => Promise<void>;
}

export function StaffDetailsTab({
  staffMember,
  isEditing,
  isLoading,
  onEdit,
  onCancelEdit,
  onSubmit
}: StaffDetailsTabProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      firstName: (staffMember as any).first_name || '',
      lastName: (staffMember as any).last_name || '',
      email: staffMember.email || '',
      phoneNumber: (staffMember as any).phone_number || '',
      role: staffMember.role as any,
      status: staffMember.status as any,
      officeKeyNumber: (staffMember as any).office_key_number || null,
      hasParkingRemote: (staffMember as any).has_parking_remote || 'NONE',
      availability_monday: (staffMember as any).availability_monday || false,
      availability_tuesday: (staffMember as any).availability_tuesday || false,
      availability_wednesday: (staffMember as any).availability_wednesday || false,
      availability_thursday: (staffMember as any).availability_thursday || false,
      availability_friday: (staffMember as any).availability_friday || false,
      availability_saturday_am: (staffMember as any).availability_saturday_am || false,
      availability_saturday_pm: (staffMember as any).availability_saturday_pm || false,
      availability_sunday_am: (staffMember as any).availability_sunday_am || false,
      availability_sunday_pm: (staffMember as any).availability_sunday_pm || false,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Staff details</h3>
        {!isEditing && (
          <Button 
            variant="outline" 
            size="sm"
            className="flex items-center gap-2" 
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        )}
      </div>

      {isEditing ? (
        // Edit Mode
        <form id="staff-edit-form" onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input 
                id="firstName" 
                {...form.register('firstName')} 
                disabled={isLoading} 
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
                disabled={isLoading} 
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
              disabled={isLoading} 
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
              disabled={isLoading} 
              placeholder="e.g. +12345678901"
            />
            {form.formState.errors.phoneNumber && (
              <p className="text-sm text-red-500">{form.formState.errors.phoneNumber.message}</p>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="officeKeyNumber">Office Key Number</Label>
              <Input
                id="officeKeyNumber"
                type="number"
                {...form.register('officeKeyNumber', { 
                  setValueAs: (v) => {
                    if (v === '' || v === null || v === undefined) return null;
                    const parsed = parseInt(v, 10);
                    return isNaN(parsed) ? null : parsed;
                  }
                })}
                disabled={isLoading}
                placeholder="Enter key number"
              />
              {form.formState.errors.officeKeyNumber && (
                <p className="text-sm text-red-500">{form.formState.errors.officeKeyNumber.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="hasParkingRemote">Parking Remote</Label>
              <Controller
                control={form.control}
                name="hasParkingRemote"
                render={({ field }) => (
                  <Select
                    disabled={isLoading}
                    value={field.value || 'NONE'}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="hasParkingRemote">
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
              {form.formState.errors.hasParkingRemote && (
                <p className="text-sm text-red-500">{form.formState.errors.hasParkingRemote.message}</p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Select 
                    disabled={isLoading}
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
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select 
                    disabled={isLoading}
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
                      disabled={isLoading}
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
                      disabled={isLoading}
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
                      disabled={isLoading}
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
                      disabled={isLoading}
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
                      disabled={isLoading}
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
                      disabled={isLoading}
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
                      disabled={isLoading}
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
                      disabled={isLoading}
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
                      disabled={isLoading}
                    />
                  )}
                />
                <Label htmlFor="availability_sunday_pm">Sunday PM</Label>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancelEdit}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      ) : (
        // View Mode
        <>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
            <div className="text-sm font-medium">First Name:</div>
            <div className="min-w-0">{(staffMember as any).first_name || '-'}</div>
            
            <div className="text-sm font-medium">Last Name:</div>
            <div className="min-w-0">{(staffMember as any).last_name || '-'}</div>
            
            <div className="text-sm font-medium">Email:</div>
            <div className="min-w-0 truncate" title={staffMember.email || ''}>
              {staffMember.email || '-'}
            </div>
            
            <div className="text-sm font-medium">Phone Number:</div>
            <div className="min-w-0">{(staffMember as any).phone_number || '-'}</div>
            
            <div className="text-sm font-medium">Office Key Number:</div>
            <div className="min-w-0">{(staffMember as any).office_key_number || '-'}</div>
            
            <div className="text-sm font-medium">Parking Remote:</div>
            <div className="min-w-0">{(staffMember as any).has_parking_remote || 'None'}</div>
            
            <div className="text-sm font-medium">Role:</div>
            <div className="min-w-0">
              <StaffRoleBadge value={staffMember.role as any} />
            </div>
            
            <div className="text-sm font-medium">Status:</div>
            <div className="min-w-0">
              <StaffStatusBadge value={staffMember.status as any} />
            </div>
            
          </div>
          
          <Separator className="my-4" />
          
          <div>
            <h3 className="text-sm font-medium mb-3">Availability</h3>
            <div className="grid grid-cols-3 gap-y-2">
              {(staffMember as any).availability_monday && (
                <span className="text-sm">Monday</span>
              )}
              {(staffMember as any).availability_tuesday && (
                <span className="text-sm">Tuesday</span>
              )}
              {(staffMember as any).availability_wednesday && (
                <span className="text-sm">Wednesday</span>
              )}
              {(staffMember as any).availability_thursday && (
                <span className="text-sm">Thursday</span>
              )}
              {(staffMember as any).availability_friday && (
                <span className="text-sm">Friday</span>
              )}
              {(staffMember as any).availability_saturday_am && (
                <span className="text-sm">Saturday AM</span>
              )}
              {(staffMember as any).availability_saturday_pm && (
                <span className="text-sm">Saturday PM</span>
              )}
              {(staffMember as any).availability_sunday_am && (
                <span className="text-sm">Sunday AM</span>
              )}
              {(staffMember as any).availability_sunday_pm && (
                <span className="text-sm">Sunday PM</span>
              )}
              {![
                (staffMember as any).availability_monday,
                (staffMember as any).availability_tuesday,
                (staffMember as any).availability_wednesday,
                (staffMember as any).availability_thursday,
                (staffMember as any).availability_friday,
                (staffMember as any).availability_saturday_am,
                (staffMember as any).availability_saturday_pm,
                (staffMember as any).availability_sunday_am,
                (staffMember as any).availability_sunday_pm
              ].some(Boolean) && (
                <span className="text-sm text-muted-foreground">No availability set</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export { formSchema };
export type { FormData as StaffDetailsFormData }; 