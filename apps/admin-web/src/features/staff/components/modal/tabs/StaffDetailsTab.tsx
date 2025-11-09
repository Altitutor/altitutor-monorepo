import { useState } from 'react';
import type { Tables } from '@altitutor/shared';
import { Badge } from "@altitutor/ui";
import { StaffRoleBadge, StaffStatusBadge, BooleanBadge } from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Label } from "@altitutor/ui";
import { Checkbox } from "@altitutor/ui";
import { Separator } from "@altitutor/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@altitutor/ui";
import { Loader2, Pencil, X } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { getSubjectIcon } from '@/shared/utils';

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
    },
  });

  return isEditing ? (
    <>
      {/* Edit Mode with Sticky Footer */}
      <div className="flex-1 overflow-y-auto px-1">
        <form id="staff-edit-form" onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6 pb-6">
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

        </form>

        {/* Subjects Section - Edit Mode */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Subjects</h3>
            {addSubjectButton}
          </div>
          
          {loadingSubjects ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : staffSubjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subjects assigned to this staff member</p>
          ) : (
            <div className="space-y-2">
              {staffSubjects.map((subject) => {
                const Icon = getSubjectIcon(subject.discipline);
                const subjectDisplay = [
                  subject.curriculum,
                  subject.year_level ? `Year ${subject.year_level}` : '',
                  subject.name
                ].filter(Boolean).join(' ');
                
                return (
                  <div
                    key={subject.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => onViewSubject?.(subject.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{subjectDisplay}</div>
                        {subject.level && (
                          <p className="text-xs text-muted-foreground">{subject.level}</p>
                        )}
                      </div>
                    </div>
                    {onRemoveSubject && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveSubject(subject.id);
                        }}
                        className="flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Footer with Buttons */}
      <div className="flex-shrink-0 border-t bg-background p-4 flex justify-end space-x-2">
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
          form="staff-edit-form"
          disabled={isLoading}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
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
          </div>
          
          <Separator className="my-6" />
          
          {/* Availability Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Availability</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">Weekdays</h4>
                <div className="space-y-2">
                  {([
                    { key: 'availability_monday' as const, label: 'Monday' },
                    { key: 'availability_tuesday' as const, label: 'Tuesday' },
                    { key: 'availability_wednesday' as const, label: 'Wednesday' },
                    { key: 'availability_thursday' as const, label: 'Thursday' },
                    { key: 'availability_friday' as const, label: 'Friday' },
                  ] as const).map(({ key, label }) => (
                    <div key={key} className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${staffMember[key] ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className={`text-sm ${staffMember[key] ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Weekends</h4>
                <div className="space-y-2">
                  {([
                    { key: 'availability_saturday_am' as const, label: 'Saturday AM' },
                    { key: 'availability_saturday_pm' as const, label: 'Saturday PM' },
                    { key: 'availability_sunday_am' as const, label: 'Sunday AM' },
                    { key: 'availability_sunday_pm' as const, label: 'Sunday PM' },
                  ] as const).map(({ key, label }) => (
                    <div key={key} className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${staffMember[key] ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className={`text-sm ${staffMember[key] ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Subjects Section - View Only */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Subjects</h3>
            </div>
            
            {loadingSubjects ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : staffSubjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subjects assigned to this staff member</p>
            ) : (
              <div className="space-y-2">
                {staffSubjects.map((subject) => {
                  const Icon = getSubjectIcon(subject.discipline);
                  const subjectDisplay = [
                    subject.curriculum,
                    subject.year_level ? `Year ${subject.year_level}` : '',
                    subject.name
                  ].filter(Boolean).join(' ');
                  
                  return (
                    <div
                      key={subject.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => onViewSubject?.(subject.id)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{subjectDisplay}</div>
                          {subject.level && (
                            <p className="text-xs text-muted-foreground">{subject.level}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
    </div>
  );
}

export { formSchema };
export type { FormData as StaffDetailsFormData }; 