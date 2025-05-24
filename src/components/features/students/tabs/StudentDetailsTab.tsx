import { useState } from 'react';
import { Student, StudentStatus } from "@/lib/supabase/db/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Pencil } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Form schema for student details
const formSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  studentEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  studentPhone: z.string().optional().nullish(),
  parentFirstName: z.string().optional().nullish(),
  parentLastName: z.string().optional().nullish(),
  parentEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  parentPhone: z.string().optional().nullish(),
  school: z.string().optional().nullish(),
  curriculum: z.string().optional().nullish(),
  yearLevel: z.union([
    z.number().min(1).max(12).nullable(),
    z.literal('').transform(() => null)
  ]).optional(),
  status: z.nativeEnum(StudentStatus),
  notes: z.string().optional().nullish(),
  
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

const getStatusBadgeColor = (status: StudentStatus) => {
  switch (status) {
    case StudentStatus.ACTIVE:
      return 'bg-green-100 text-green-800';
    case StudentStatus.INACTIVE:
      return 'bg-gray-100 text-gray-800';
    case StudentStatus.TRIAL:
      return 'bg-orange-100 text-orange-800';
    case StudentStatus.DISCONTINUED:
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

interface StudentDetailsTabProps {
  student: Student;
  isEditing: boolean;
  isLoading: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSubmit: (data: FormData) => Promise<void>;
}

export function StudentDetailsTab({
  student,
  isEditing,
  isLoading,
  onEdit,
  onCancelEdit,
  onSubmit
}: StudentDetailsTabProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      firstName: student.firstName || '',
      lastName: student.lastName || '',
      studentEmail: student.studentEmail || '',
      studentPhone: student.studentPhone || '',
      parentFirstName: student.parentFirstName || '',
      parentLastName: student.parentLastName || '',
      parentEmail: student.parentEmail || '',
      parentPhone: student.parentPhone || '',
      school: student.school || '',
      curriculum: student.curriculum || '',
      yearLevel: student.yearLevel || null,
      status: student.status,
      notes: student.notes || '',
      availability_monday: student.availabilityMonday || false,
      availability_tuesday: student.availabilityTuesday || false,
      availability_wednesday: student.availabilityWednesday || false,
      availability_thursday: student.availabilityThursday || false,
      availability_friday: student.availabilityFriday || false,
      availability_saturday_am: student.availabilitySaturdayAm || false,
      availability_saturday_pm: student.availabilitySaturdayPm || false,
      availability_sunday_am: student.availabilitySundayAm || false,
      availability_sunday_pm: student.availabilitySundayPm || false,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Student details</h3>
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
        <form id="student-edit-form" onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
          {/* Student Information */}
          <div className="space-y-4">
            <h4 className="text-md font-medium">Student Information</h4>
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
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="studentEmail">Student Email</Label>
                <Input 
                  id="studentEmail" 
                  type="email" 
                  {...form.register('studentEmail')} 
                  disabled={isLoading} 
                />
                {form.formState.errors.studentEmail && (
                  <p className="text-sm text-red-500">{form.formState.errors.studentEmail.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="studentPhone">Student Phone</Label>
                <Input 
                  id="studentPhone" 
                  {...form.register('studentPhone')} 
                  disabled={isLoading} 
                />
                {form.formState.errors.studentPhone && (
                  <p className="text-sm text-red-500">{form.formState.errors.studentPhone.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Parent Information */}
          <div className="space-y-4">
            <h4 className="text-md font-medium">Parent Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="parentFirstName">Parent First Name</Label>
                <Input 
                  id="parentFirstName" 
                  {...form.register('parentFirstName')} 
                  disabled={isLoading} 
                />
                {form.formState.errors.parentFirstName && (
                  <p className="text-sm text-red-500">{form.formState.errors.parentFirstName.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="parentLastName">Parent Last Name</Label>
                <Input 
                  id="parentLastName" 
                  {...form.register('parentLastName')} 
                  disabled={isLoading} 
                />
                {form.formState.errors.parentLastName && (
                  <p className="text-sm text-red-500">{form.formState.errors.parentLastName.message}</p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="parentEmail">Parent Email</Label>
                <Input 
                  id="parentEmail" 
                  type="email" 
                  {...form.register('parentEmail')} 
                  disabled={isLoading} 
                />
                {form.formState.errors.parentEmail && (
                  <p className="text-sm text-red-500">{form.formState.errors.parentEmail.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="parentPhone">Parent Phone</Label>
                <Input 
                  id="parentPhone" 
                  {...form.register('parentPhone')} 
                  disabled={isLoading} 
                />
                {form.formState.errors.parentPhone && (
                  <p className="text-sm text-red-500">{form.formState.errors.parentPhone.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Academic Information */}
          <div className="space-y-4">
            <h4 className="text-md font-medium">Academic Information</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="school">School</Label>
                <Input 
                  id="school" 
                  {...form.register('school')} 
                  disabled={isLoading} 
                />
                {form.formState.errors.school && (
                  <p className="text-sm text-red-500">{form.formState.errors.school.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="curriculum">Curriculum</Label>
                <Input 
                  id="curriculum" 
                  {...form.register('curriculum')} 
                  disabled={isLoading}
                  placeholder="e.g., SACE, IB, VCE"
                />
                {form.formState.errors.curriculum && (
                  <p className="text-sm text-red-500">{form.formState.errors.curriculum.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="yearLevel">Year Level</Label>
                <Input
                  id="yearLevel"
                  type="number"
                  min="1"
                  max="12"
                  {...form.register('yearLevel', { 
                    setValueAs: (v) => {
                      if (v === '' || v === null || v === undefined) return null;
                      const parsed = parseInt(v, 10);
                      return isNaN(parsed) ? null : parsed;
                    }
                  })}
                  disabled={isLoading}
                />
                {form.formState.errors.yearLevel && (
                  <p className="text-sm text-red-500">{form.formState.errors.yearLevel.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Status */}
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
                    <SelectItem value={StudentStatus.TRIAL}>Trial</SelectItem>
                    <SelectItem value={StudentStatus.ACTIVE}>Active</SelectItem>
                    <SelectItem value={StudentStatus.INACTIVE}>Inactive</SelectItem>
                    <SelectItem value={StudentStatus.DISCONTINUED}>Discontinued</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.status && (
              <p className="text-sm text-red-500">{form.formState.errors.status.message}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...form.register('notes')}
              disabled={isLoading}
              placeholder="Any additional notes about the student..."
              rows={3}
            />
            {form.formState.errors.notes && (
              <p className="text-sm text-red-500">{form.formState.errors.notes.message}</p>
            )}
          </div>
          
          {/* Availability */}
          <div className="space-y-2">
            <Label>Availability</Label>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <h5 className="font-medium text-sm">Weekdays</h5>
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((day) => (
                  <div key={day} className="flex items-center space-x-2">
                    <Controller
                      control={form.control}
                      name={`availability_${day}` as keyof FormData}
                      render={({ field }) => (
                        <Checkbox 
                          id={`availability_${day}`} 
                          checked={field.value as boolean}
                          onCheckedChange={field.onChange}
                          disabled={isLoading}
                        />
                      )}
                    />
                    <Label htmlFor={`availability_${day}`} className="text-sm capitalize">
                      {day}
                    </Label>
                  </div>
                ))}
              </div>
              
              <div className="space-y-2">
                <h5 className="font-medium text-sm">Saturday</h5>
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
                  <Label htmlFor="availability_saturday_am" className="text-sm">Morning</Label>
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
                  <Label htmlFor="availability_saturday_pm" className="text-sm">Afternoon</Label>
                </div>
              </div>
              
              <div className="space-y-2">
                <h5 className="font-medium text-sm">Sunday</h5>
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
                  <Label htmlFor="availability_sunday_am" className="text-sm">Morning</Label>
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
                  <Label htmlFor="availability_sunday_pm" className="text-sm">Afternoon</Label>
                </div>
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
          {/* Student Information */}
          <div className="space-y-4">
            <h4 className="text-md font-medium">Student Information</h4>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
              <div className="text-sm font-medium">First Name:</div>
              <div className="min-w-0">{student.firstName || '-'}</div>
              
              <div className="text-sm font-medium">Last Name:</div>
              <div className="min-w-0">{student.lastName || '-'}</div>
              
              <div className="text-sm font-medium">Student Email:</div>
              <div className="min-w-0 truncate" title={student.studentEmail || ''}>
                {student.studentEmail || '-'}
              </div>
              
              <div className="text-sm font-medium">Student Phone:</div>
              <div className="min-w-0">{student.studentPhone || '-'}</div>
            </div>
          </div>

          <Separator />

          {/* Parent Information */}
          <div className="space-y-4">
            <h4 className="text-md font-medium">Parent Information</h4>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
              <div className="text-sm font-medium">Parent Name:</div>
              <div className="min-w-0">
                {student.parentFirstName || student.parentLastName 
                  ? `${student.parentFirstName || ''} ${student.parentLastName || ''}`.trim()
                  : '-'
                }
              </div>
              
              <div className="text-sm font-medium">Parent Email:</div>
              <div className="min-w-0 truncate" title={student.parentEmail || ''}>
                {student.parentEmail || '-'}
              </div>
              
              <div className="text-sm font-medium">Parent Phone:</div>
              <div className="min-w-0">{student.parentPhone || '-'}</div>
            </div>
          </div>

          <Separator />

          {/* Academic Information */}
          <div className="space-y-4">
            <h4 className="text-md font-medium">Academic Information</h4>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
              <div className="text-sm font-medium">School:</div>
              <div className="min-w-0">{student.school || '-'}</div>
              
              <div className="text-sm font-medium">Curriculum:</div>
              <div className="min-w-0">{student.curriculum || '-'}</div>
              
              <div className="text-sm font-medium">Year Level:</div>
              <div className="min-w-0">{student.yearLevel || '-'}</div>
              
              <div className="text-sm font-medium">Status:</div>
              <div className="min-w-0">
                <Badge className={getStatusBadgeColor(student.status)}>
                  {student.status}
                </Badge>
              </div>
              
              <div className="text-sm font-medium">Created:</div>
              <div className="min-w-0">{new Date(student.created_at).toLocaleDateString()}</div>
            </div>
          </div>

          {student.notes && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-md font-medium">Notes</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{student.notes}</p>
              </div>
            </>
          )}
          
          <Separator />
          
          <div>
            <h4 className="text-md font-medium mb-3">Availability</h4>
            <div className="grid grid-cols-3 gap-y-2">
              {student.availabilityMonday && (
                <span className="text-sm">Monday</span>
              )}
              {student.availabilityTuesday && (
                <span className="text-sm">Tuesday</span>
              )}
              {student.availabilityWednesday && (
                <span className="text-sm">Wednesday</span>
              )}
              {student.availabilityThursday && (
                <span className="text-sm">Thursday</span>
              )}
              {student.availabilityFriday && (
                <span className="text-sm">Friday</span>
              )}
              {student.availabilitySaturdayAm && (
                <span className="text-sm">Saturday AM</span>
              )}
              {student.availabilitySaturdayPm && (
                <span className="text-sm">Saturday PM</span>
              )}
              {student.availabilitySundayAm && (
                <span className="text-sm">Sunday AM</span>
              )}
              {student.availabilitySundayPm && (
                <span className="text-sm">Sunday PM</span>
              )}
              {![
                student.availabilityMonday,
                student.availabilityTuesday,
                student.availabilityWednesday,
                student.availabilityThursday,
                student.availabilityFriday,
                student.availabilitySaturdayAm,
                student.availabilitySaturdayPm,
                student.availabilitySundayAm,
                student.availabilitySundayPm
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
export type { FormData as StudentDetailsFormData }; 