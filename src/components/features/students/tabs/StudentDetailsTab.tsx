import { useState } from 'react';
import { Student, StudentStatus, SubjectCurriculum } from "@/lib/supabase/db/types";
import { Badge } from "@/components/ui/badge";
import { StudentStatusBadge } from "@/components/ui/enum-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Pencil, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Form schema for student details only
const formSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  studentEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  studentPhone: z.string().optional().nullish(),
  school: z.string().optional().nullish(),
  curriculum: z.string().optional().nullish(),
  yearLevel: z.union([
    z.number().min(1).max(12).nullable(),
    z.literal('').transform(() => null)
  ]).optional(),
  status: z.nativeEnum(StudentStatus),
  notes: z.string().optional().nullish(),
});

type FormData = z.infer<typeof formSchema>;

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
      school: student.school || '',
      curriculum: student.curriculum || '',
      yearLevel: student.yearLevel || null,
      status: student.status,
      notes: student.notes || '',
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
              <div className="flex gap-2">
                <Select 
                  value={form.watch('curriculum') || undefined} 
                  onValueChange={(value) => form.setValue('curriculum', value || null)}
                  disabled={isLoading}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select curriculum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SubjectCurriculum.SACE}>{SubjectCurriculum.SACE}</SelectItem>
                    <SelectItem value={SubjectCurriculum.IB}>{SubjectCurriculum.IB}</SelectItem>
                    <SelectItem value={SubjectCurriculum.PRESACE}>{SubjectCurriculum.PRESACE}</SelectItem>
                    <SelectItem value={SubjectCurriculum.PRIMARY}>{SubjectCurriculum.PRIMARY}</SelectItem>
                    <SelectItem value={SubjectCurriculum.MEDICINE}>{SubjectCurriculum.MEDICINE}</SelectItem>
                  </SelectContent>
                </Select>
                {form.watch('curriculum') && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => form.setValue('curriculum', null)}
                    disabled={isLoading}
                    title="Clear curriculum"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {form.formState.errors.curriculum && (
                <p className="text-sm text-red-500">{form.formState.errors.curriculum.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="yearLevel">Year Level</Label>
              <div className="flex gap-2">
                <Select 
                  value={form.watch('yearLevel') ? String(form.watch('yearLevel')) : undefined} 
                  onValueChange={(value) => form.setValue('yearLevel', value ? Number(value) : null)}
                  disabled={isLoading}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select year level" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((year) => (
                      <SelectItem key={year} value={String(year)}>Year {year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.watch('yearLevel') && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => form.setValue('yearLevel', null)}
                    disabled={isLoading}
                    title="Clear year level"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {form.formState.errors.yearLevel && (
                <p className="text-sm text-red-500">{form.formState.errors.yearLevel.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select 
              value={form.watch('status')} 
              onValueChange={(value) => form.setValue('status', value as StudentStatus)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={StudentStatus.ACTIVE}>Active</SelectItem>
                <SelectItem value={StudentStatus.INACTIVE}>Inactive</SelectItem>
                <SelectItem value={StudentStatus.TRIAL}>Trial</SelectItem>
                <SelectItem value={StudentStatus.DISCONTINUED}>Discontinued</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.status && (
              <p className="text-sm text-red-500">{form.formState.errors.status.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea 
              id="notes" 
              {...form.register('notes')} 
              disabled={isLoading}
              rows={3}
            />
            {form.formState.errors.notes && (
              <p className="text-sm text-red-500">{form.formState.errors.notes.message}</p>
            )}
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
        <div className="space-y-4">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
            <div className="text-sm font-medium">Name:</div>
            <div className="min-w-0">{student.firstName || ''} {student.lastName || ''}</div>
            
            <div className="text-sm font-medium">Student Email:</div>
            <div className="min-w-0 truncate" title={student.studentEmail || ''}>
              {student.studentEmail || '-'}
            </div>
            
            <div className="text-sm font-medium">Student Phone:</div>
            <div className="min-w-0">{student.studentPhone || '-'}</div>
            
            <div className="text-sm font-medium">School:</div>
            <div className="min-w-0">{student.school || '-'}</div>
            
            <div className="text-sm font-medium">Curriculum:</div>
            <div className="min-w-0">{student.curriculum || '-'}</div>
            
            <div className="text-sm font-medium">Year Level:</div>
            <div className="min-w-0">{student.yearLevel ? `Year ${student.yearLevel}` : '-'}</div>
            
            <div className="text-sm font-medium">Status:</div>
            <div className="min-w-0">
              <StudentStatusBadge value={student.status} />
            </div>
            
            {student.notes && (
              <>
                <div className="text-sm font-medium">Notes:</div>
                <div className="min-w-0 text-sm whitespace-pre-wrap">{student.notes}</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { formSchema };
export type { FormData as StudentDetailsFormData }; 