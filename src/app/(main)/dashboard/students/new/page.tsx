'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { StudentForm, StudentFormData } from '@/components/features/students';
import { useStudents } from '@/lib/hooks';
import { Student, StudentStatus } from '@/lib/supabase/db/types';
import { toast } from 'sonner';

export default function NewStudentPage() {
  const router = useRouter();
  const { create } = useStudents();

  const handleSubmit = async (data: StudentFormData) => {
    try {
      // Convert StudentFormData to Partial<Student>
      const studentData: Partial<Student> = {
        ...data,
        status: data.status as StudentStatus
      };
      
      await create(studentData);
      toast.success('Student created successfully');
      router.push('/dashboard/students');
    } catch (error) {
      console.error('Error creating student:', error);
      toast.error('Failed to create student');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">New Student</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Information</CardTitle>
          <CardDescription>Enter the details for the new student.</CardDescription>
        </CardHeader>
        <CardContent>
          <StudentForm onSubmit={handleSubmit} />
        </CardContent>
      </Card>
    </div>
  );
} 