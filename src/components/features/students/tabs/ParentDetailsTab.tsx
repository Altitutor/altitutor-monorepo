import { useState } from 'react';
import { Student } from "@/lib/supabase/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, Pencil } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Form schema for parent details
const formSchema = z.object({
  parentFirstName: z.string().optional().nullish(),
  parentLastName: z.string().optional().nullish(),
  parentEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  parentPhone: z.string().optional().nullish(),
});

type FormData = z.infer<typeof formSchema>;

interface ParentDetailsTabProps {
  student: Student;
  isEditing: boolean;
  isLoading: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSubmit: (data: FormData) => Promise<void>;
}

export function ParentDetailsTab({
  student,
  isEditing,
  isLoading,
  onEdit,
  onCancelEdit,
  onSubmit
}: ParentDetailsTabProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      parentFirstName: student.parentFirstName || '',
      parentLastName: student.parentLastName || '',
      parentEmail: student.parentEmail || '',
      parentPhone: student.parentPhone || '',
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Parent details</h3>
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
        <form id="parent-edit-form" onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
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
      )}
    </div>
  );
}

export { formSchema };
export type { FormData as ParentDetailsFormData }; 