'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Label } from "@altitutor/ui";
import { PhoneInput } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Badge } from "@altitutor/ui";
import { useCreateParent } from '../hooks/useParentsQuery';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, AlertTriangle, X } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { useStudents } from '@/features/students/hooks/useStudentsQuery';
import { StudentSearchPopover } from '@/features/students/components/StudentSearchPopover';
import { studentsApi } from '@/features/students/api/students';

interface AddParentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onParentAdded: () => void;
}

// Schema for form validation
const formSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z
    .union([
      z.string().regex(/^\+?[0-9]{10,14}$/, 'Invalid phone number format'),
      z.literal(''),
      z.null()
    ])
    .transform((val) => val === '' ? null : val)
    .optional()
    .nullable(),
});

type FormData = z.infer<typeof formSchema>;

export function AddParentModal({ isOpen, onClose, onParentAdded }: AddParentModalProps) {
  const { toast } = useToast();
  const createParentMutation = useCreateParent();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Tables<'students'>[]>([]);
  
  // Get all students for the search popover
  const { data: allStudents = [] } = useStudents();
  
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
      phone: '',
    }
  });

  const onSubmit: SubmitHandler<FormData> = async (formData: FormData) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    
    try {
      const parentData: any = {
        id: crypto.randomUUID(),
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: (formData.email || null) as any,
        phone: (formData.phone || null) as any,
        created_at: null,
        updated_at: null,
      };

      const createdParent = await createParentMutation.mutateAsync(parentData);
      
      // Assign selected students to the parent
      if (selectedStudents.length > 0) {
        await Promise.all(
          selectedStudents.map(student => 
            studentsApi.assignStudentToParent(createdParent.id, student.id)
          )
        );
      }
      
      toast({
        title: "Success",
        description: "Parent added successfully.",
      });
      
      reset();
      setSelectedStudents([]);
      onParentAdded();
      onClose();
    } catch (error: any) {
      console.error('Error adding parent:', error);
      setErrorMessage(error?.message || 'Failed to add parent. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    if (!isSubmitting) {
      reset();
      setErrorMessage(null);
      setSelectedStudents([]);
      onClose();
    }
  };

  const handleSelectStudent = (student: Tables<'students'>) => {
    if (!selectedStudents.some(s => s.id === student.id)) {
      setSelectedStudents(prev => [...prev, student]);
    }
  };

  const handleRemoveStudent = (studentId: string) => {
    setSelectedStudents(prev => prev.filter(s => s.id !== studentId));
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCloseModal}>
      <DialogContent className="w-full md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Parent</DialogTitle>
          <DialogDescription>
            Enter the parent's information below to add them to the system.
          </DialogDescription>
        </DialogHeader>
        
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
            <div className="text-sm text-red-600">{errorMessage}</div>
          </div>
        )}
        
        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
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
          
          <div className="grid grid-cols-2 gap-4">
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
              <Label htmlFor="phone">Phone</Label>
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <PhoneInput
                    value={field.value || ''}
                    onChange={field.onChange}
                    disabled={isSubmitting}
                    error={errors.phone?.message}
                  />
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Students</Label>
              <StudentSearchPopover
                allStudents={allStudents}
                selectedStudents={selectedStudents}
                onSelectStudent={handleSelectStudent}
              />
            </div>
            {selectedStudents.length > 0 ? (
              <div className="flex flex-wrap gap-2 p-3 border rounded-md min-h-[60px]">
                {selectedStudents.map((student) => (
                  <Badge
                    key={student.id}
                    variant="secondary"
                    className="flex items-center gap-1 pr-1"
                  >
                    <span>
                      {student.first_name} {student.last_name}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 hover:bg-transparent"
                      onClick={() => handleRemoveStudent(student.id)}
                      disabled={isSubmitting}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="p-3 border rounded-md min-h-[60px] flex items-center">
                <p className="text-sm text-muted-foreground">No students assigned</p>
              </div>
            )}
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Parent
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

