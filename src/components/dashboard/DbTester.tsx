'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useStudents } from '@/lib/db/hooks';
import { StudentStatus } from '@/lib/db/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export function DbTester() {
  const { items: students, fetchAll, create, update, remove } = useStudents();
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const resetStatus = () => {
    setStatus('idle');
    setMessage('');
  };

  const handleSuccess = (msg: string) => {
    setStatus('success');
    setMessage(msg);
    setLoading(false);
  };

  const handleError = (error: any) => {
    setStatus('error');
    setMessage(error?.message || 'An error occurred');
    setLoading(false);
  };

  const handleCreateTest = async () => {
    resetStatus();
    setLoading(true);

    try {
      // Create a test student
      const testStudent = {
        firstName: 'Test',
        lastName: `Student ${new Date().toISOString().slice(0, 19)}`,
        email: `test.${Date.now()}@example.com`,
        status: StudentStatus.TRIAL
      };

      await create(testStudent);
      await fetchAll(); // Refresh the list
      handleSuccess('Test student created successfully');
    } catch (error) {
      handleError(error);
    }
  };

  const handleUpdateTest = async () => {
    resetStatus();
    setLoading(true);

    try {
      if (students.length === 0) {
        throw new Error('No students to update. Create a test student first.');
      }

      // Update the first student
      const student = students[0];
      await update(student.id, {
        first_name: `Updated ${new Date().toLocaleTimeString()}`,
      });
      await fetchAll(); // Refresh the list
      handleSuccess('Student updated successfully');
    } catch (error) {
      handleError(error);
    }
  };

  const handleDeleteTest = async () => {
    resetStatus();
    setLoading(true);

    try {
      if (students.length === 0) {
        throw new Error('No students to delete. Create a test student first.');
      }

      // Delete the first student
      const student = students[0];
      await remove(student.id);
      await fetchAll(); // Refresh the list
      handleSuccess('Student deleted successfully');
    } catch (error) {
      handleError(error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Button onClick={handleCreateTest} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Create
        </Button>
        <Button onClick={handleUpdateTest} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Update
        </Button>
        <Button onClick={handleDeleteTest} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Delete
        </Button>
      </div>

      {status === 'success' && (
        <Alert variant="default" className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Success</AlertTitle>
          <AlertDescription className="text-green-700">{message}</AlertDescription>
        </Alert>
      )}

      {status === 'error' && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="text-xs text-muted-foreground mt-2">
        <p>Test count: {students.length} student(s)</p>
      </div>
    </div>
  );
} 