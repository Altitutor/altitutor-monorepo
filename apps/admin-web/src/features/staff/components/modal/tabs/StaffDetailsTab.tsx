import { useState, useEffect, useRef } from 'react';
import type { Tables } from '@altitutor/shared';
import { Badge } from "@altitutor/ui";
import { StaffRoleBadge, StaffStatusBadge, BooleanBadge } from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Label } from "@altitutor/ui";
import { Checkbox } from "@altitutor/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { Separator } from "@altitutor/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@altitutor/ui";
import { Loader2, Pencil, X, Check } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatSubjectShortName, getSubjectCurriculumColor } from '@/shared/utils';

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
  // Subjects props
  staffSubjects?: Tables<'subjects'>[];
  loadingSubjects?: boolean;
  onRemoveSubject?: (subjectId: string) => void;
  onViewSubject?: (subjectId: string) => void;
  addSubjectButton?: React.ReactNode;
}

export function StaffDetailsTab({
  staffMember,
  isEditing,
  isLoading,
  onEdit,
  onCancelEdit,
  onSubmit,
  staffSubjects = [],
  loadingSubjects = false,
  onRemoveSubject,
  onViewSubject,
  addSubjectButton
}: StaffDetailsTabProps) {
  const form = useForm<FormData>({
    // @ts-expect-error - Type mismatch due to duplicate react-hook-form types in node_modules
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      role: undefined,
      status: undefined,
      officeKeyNumber: null,
      hasParkingRemote: 'NONE' as const,
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

  const hasResetRef = useRef(false);

  // Reset form values when entering edit mode - only once per edit session
  useEffect(() => {
    if (isEditing && !hasResetRef.current) {
      form.reset({
        firstName: staffMember.first_name || '',
        lastName: staffMember.last_name || '',
        email: staffMember.email || '',
        phoneNumber: staffMember.phone_number || '',
        role: (staffMember.role === 'TUTOR' || staffMember.role === 'ADMINSTAFF') ? staffMember.role : undefined,
        status: (staffMember.status === 'ACTIVE' || staffMember.status === 'INACTIVE' || staffMember.status === 'TRIAL') ? staffMember.status : undefined,
        officeKeyNumber: staffMember.office_key_number || null,
        hasParkingRemote: (staffMember.has_parking_remote === 'VIRTUAL' || staffMember.has_parking_remote === 'PHYSICAL' || staffMember.has_parking_remote === 'NONE') ? staffMember.has_parking_remote : 'NONE',
        availability_monday: staffMember.availability_monday || false,
        availability_tuesday: staffMember.availability_tuesday || false,
        availability_wednesday: staffMember.availability_wednesday || false,
        availability_thursday: staffMember.availability_thursday || false,
        availability_friday: staffMember.availability_friday || false,
        availability_saturday_am: staffMember.availability_saturday_am || false,
        availability_saturday_pm: staffMember.availability_saturday_pm || false,
        availability_sunday_am: staffMember.availability_sunday_am || false,
        availability_sunday_pm: staffMember.availability_sunday_pm || false,
      });
      hasResetRef.current = true;
    } else if (!isEditing) {
      // Reset the flag when exiting edit mode
      hasResetRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, staffMember.id]); // form is stable, don't include it

  return isEditing ? (
    <>
      {/* Edit Mode with Sticky Footer */}
      <div className="flex-1 overflow-y-auto px-1">
        <form 
          id="staff-edit-form" 
          onSubmit={form.handleSubmit(onSubmit as any)} 
          className="space-y-6 pb-6"
        >
          {/* Staff Details Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Staff Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Controller
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <Input 
                        id="firstName" 
                        {...field}
                        disabled={isLoading} 
                        required
                      />
                    )}
                  />
                  {form.formState.errors.firstName && (
                    <p className="text-sm text-red-500">{form.formState.errors.firstName.message}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Controller
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <Input 
                        id="lastName" 
                        {...field}
                        disabled={isLoading} 
                        required
                      />
                    )}
                  />
                  {form.formState.errors.lastName && (
                    <p className="text-sm text-red-500">{form.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Controller
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <Input 
                        id="email" 
                        type="email" 
                        {...field}
                        disabled={isLoading} 
                      />
                    )}
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Controller
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <Input 
                        id="phoneNumber" 
                        {...field}
                        value={field.value ?? ''}
                        disabled={isLoading} 
                        placeholder="e.g. +12345678901"
                      />
                    )}
                  />
                  {form.formState.errors.phoneNumber && (
                    <p className="text-sm text-red-500">{form.formState.errors.phoneNumber.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="officeKeyNumber">Office Key Number</Label>
                  <Controller
                    control={form.control}
                    name="officeKeyNumber"
                    render={({ field }) => (
                      <Input
                        id="officeKeyNumber"
                        type="number"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          field.onChange(value === '' || value === null || value === undefined ? null : parseInt(value, 10));
                        }}
                        disabled={isLoading}
                        placeholder="Enter key number"
                      />
                    )}
                  />
                  {form.formState.errors.officeKeyNumber && (
                    <p className="text-sm text-red-500">{form.formState.errors.officeKeyNumber.message}</p>
                  )}
                </div>
                
                <div>
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
                <div>
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
                
                <div>
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

              {/* Subjects Field */}
              <div>
                <Label>Subjects</Label>
                <div className="space-y-2">
                  {staffSubjects.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {staffSubjects.map((subject) => {
                        const shortName = formatSubjectShortName(subject);
                        const colorClass = getSubjectCurriculumColor(subject.curriculum);
                        return (
                          <Badge
                            key={subject.id}
                            className={`${colorClass} cursor-pointer hover:opacity-80 flex items-center gap-1 pr-1`}
                            onClick={(e) => {
                              // Don't trigger view if clicking the X button
                              if ((e.target as HTMLElement).closest('.remove-subject-btn')) {
                                return;
                              }
                              onViewSubject?.(subject.id);
                            }}
                          >
                            <span>{shortName}</span>
                            {onRemoveSubject && (
                              <button
                                type="button"
                                className="remove-subject-btn ml-1 rounded-full hover:bg-black/20 p-0.5 flex items-center justify-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveSubject(subject.id);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  {addSubjectButton}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Availability Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Availability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium">Weekdays</h4>
                  {[
                    { key: 'availability_monday', label: 'Monday' },
                    { key: 'availability_tuesday', label: 'Tuesday' },
                    { key: 'availability_wednesday', label: 'Wednesday' },
                    { key: 'availability_thursday', label: 'Thursday' },
                    { key: 'availability_friday', label: 'Friday' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Controller
                        control={form.control}
                        name={key as keyof FormData}
                        render={({ field }) => (
                          <Checkbox 
                            id={key} 
                            checked={field.value as boolean}
                            onCheckedChange={field.onChange}
                            disabled={isLoading}
                          />
                        )}
                      />
                      <Label htmlFor={key}>{label}</Label>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Weekends</h4>
                  {[
                    { key: 'availability_saturday_am', label: 'Saturday AM' },
                    { key: 'availability_saturday_pm', label: 'Saturday PM' },
                    { key: 'availability_sunday_am', label: 'Sunday AM' },
                    { key: 'availability_sunday_pm', label: 'Sunday PM' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Controller
                        control={form.control}
                        name={key as keyof FormData}
                        render={({ field }) => (
                          <Checkbox 
                            id={key} 
                            checked={field.value as boolean}
                            onCheckedChange={field.onChange}
                            disabled={isLoading}
                          />
                        )}
                      />
                      <Label htmlFor={key}>{label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

        </form>
      </div>

      {/* Sticky Footer with Buttons */}
      <div className="flex-shrink-0 border-t bg-background p-4 flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancelEdit} disabled={isLoading}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit" form="staff-edit-form" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </>
  ) : (
    <div className="space-y-6 pb-6 flex-1 overflow-y-auto px-1">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Staff Information</h3>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="text-sm font-medium">First Name:</div>
        <div>{staffMember.first_name || '-'}</div>
        
        <div className="text-sm font-medium">Last Name:</div>
        <div>{staffMember.last_name || '-'}</div>
        
        <div className="text-sm font-medium">Email:</div>
        <div>{staffMember.email || '-'}</div>
        
        <div className="text-sm font-medium">Phone Number:</div>
        <div>{staffMember.phone_number || '-'}</div>
        
        <div className="text-sm font-medium">Office Key Number:</div>
        <div>{staffMember.office_key_number || '-'}</div>
        
        <div className="text-sm font-medium">Parking Remote:</div>
        <div>{staffMember.has_parking_remote || 'None'}</div>
        
        <div className="text-sm font-medium">Role:</div>
        <div>
          <StaffRoleBadge value={(staffMember.role === 'ADMIN' || staffMember.role === 'TUTOR' || staffMember.role === 'ADMINSTAFF') ? staffMember.role : null} />
        </div>
        
        <div className="text-sm font-medium">Status:</div>
        <div>
          <StaffStatusBadge value={(staffMember.status === 'ACTIVE' || staffMember.status === 'INACTIVE' || staffMember.status === 'TRIAL') ? staffMember.status : null} />
        </div>
        
        <div className="text-sm font-medium">Subjects:</div>
        <div>
          {staffSubjects.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {staffSubjects.map((subject) => {
                const shortName = formatSubjectShortName(subject);
                const colorClass = getSubjectCurriculumColor(subject.curriculum);
                return (
                  <Badge
                    key={subject.id}
                    className={`${colorClass} cursor-pointer hover:opacity-80`}
                    onClick={() => onViewSubject?.(subject.id)}
                  >
                    {shortName}
                  </Badge>
                );
              })}
            </div>
          ) : (
            <span className="text-muted-foreground">No subjects assigned</span>
          )}
        </div>
      </div>

      <Separator className="my-6" />

      {/* Availability Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Availability</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-3">Weekdays</h4>
            <div className="space-y-2">
              {[
                { key: 'availability_monday', label: 'Monday' },
                { key: 'availability_tuesday', label: 'Tuesday' },
                { key: 'availability_wednesday', label: 'Wednesday' },
                { key: 'availability_thursday', label: 'Thursday' },
                { key: 'availability_friday', label: 'Friday' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${staffMember[key as keyof Tables<'staff'>] ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className={`text-sm ${staffMember[key as keyof Tables<'staff'>] ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Weekends</h4>
            <div className="space-y-2">
              {[
                { key: 'availability_saturday_am', label: 'Saturday AM' },
                { key: 'availability_saturday_pm', label: 'Saturday PM' },
                { key: 'availability_sunday_am', label: 'Sunday AM' },
                { key: 'availability_sunday_pm', label: 'Sunday PM' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${staffMember[key as keyof Tables<'staff'>] ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className={`text-sm ${staffMember[key as keyof Tables<'staff'>] ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-6" />
    </div>
  );
}

export { formSchema };
export type { FormData as StaffDetailsFormData }; 