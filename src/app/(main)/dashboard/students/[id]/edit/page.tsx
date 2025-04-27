'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { StudentForm } from '@/components/features/students';
import { useStudents } from '@/lib/db/hooks';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { LoadingSpinner } from '@/components/ui/spinner';

interface EditStudentPageProps {
  params: {
    id: string;
  };
}

export default function EditStudentPage({ params }: EditStudentPageProps) {
  const router = useRouter();
  const { fetchById, update } = useStudents();
  const [student, setStudent] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStudent = async () => {
      try {
        const data = await fetchById(params.id);
        setStudent(data);
      } catch (error) {
        console.error('Error loading student:', error);
        toast.error('Failed to load student');
        router.push('/dashboard/students');
      } finally {
        setLoading(false);
      }
    };

    loadStudent();
  }, [params.id, fetchById, router]);

  const handleSubmit = async (data: unknown) => {
    try {
      await update(params.id, data);
      toast.success('Student updated successfully');
      router.push(`/dashboard/students/${params.id}`);
    } catch (error) {
      console.error('Error updating student:', error);
      toast.error('Failed to update student');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!student) {
    return null;
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Edit Student</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Information</CardTitle>
          <CardDescription>Update the student&apos;s details.</CardDescription>
        </CardHeader>
        <CardContent>
          <StudentForm onSubmit={handleSubmit} defaultValues={student} />
        </CardContent>
      </Card>
    </div>
  );
} 