'use client';

import { useState, useEffect } from 'react';
import { useStudents } from '@/lib/db/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Student, StudentStatus } from '@/lib/db/types';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, UserPlus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const statusVariants = {
  'CURRENT': 'bg-green-100 text-green-800 hover:bg-green-100',
  'INACTIVE': 'bg-gray-100 text-gray-800 hover:bg-gray-100',
  'TRIAL': 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  'DISCONTINUED': 'bg-red-100 text-red-800 hover:bg-red-100'
};

export function StudentDataTest() {
  const { items: students, loading, error, fetchAll } = useStudents();
  const [displayCount, setDisplayCount] = useState(5);

  // Function to refresh data
  const handleRefresh = () => {
    fetchAll();
  };

  // Function to show more students
  const handleShowMore = () => {
    setDisplayCount(prev => prev + 5);
  };

  // Display status as a badge
  const renderStatus = (status: StudentStatus) => {
    return (
      <Badge variant="outline" className={statusVariants[status] || ''}>
        {status}
      </Badge>
    );
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle>Students</CardTitle>
          <CardDescription>Manage student data</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="default" size="sm">
            <UserPlus className="h-4 w-4 mr-1" />
            Add Student
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-red-500 mb-4 p-2 bg-red-50 rounded">
            Error loading students: {error}
          </div>
        )}
        
        {loading ? (
          // Skeleton loader for table
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">No students found</p>
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              Add Your First Student
            </Button>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Parent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.slice(0, displayCount).map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      {student.firstName} {student.lastName}
                    </TableCell>
                    <TableCell>{student.email || 'N/A'}</TableCell>
                    <TableCell>{renderStatus(student.status)}</TableCell>
                    <TableCell>{student.parentName || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {students.length > displayCount && (
              <div className="text-center mt-4">
                <Button variant="outline" onClick={handleShowMore}>
                  Show More
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
} 