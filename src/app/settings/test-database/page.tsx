'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { databaseApi } from '@/lib/api/database';
import { toast } from 'sonner';

export default function TestDatabasePage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleAddTestStudent = async () => {
    try {
      setIsLoading(true);
      await databaseApi.addTestStudent();
      toast.success('Test student added successfully');
    } catch (error: any) {
      console.error('Error adding test student:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      toast.error(error.message || 'Failed to add test student');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-6">Test Database</h1>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Add Test Student</CardTitle>
            <CardDescription>
              Add a test student to the database for development purposes.
              Make sure you are logged in as an admin user.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleAddTestStudent} 
              disabled={isLoading}
            >
              {isLoading ? 'Adding...' : 'Add Test Student'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 