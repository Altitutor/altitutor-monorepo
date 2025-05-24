'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { StudentsTable, AddStudentModal, ViewStudentModal } from '@/components/features/students';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';

export default function StudentsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Handle view query parameter
  useEffect(() => {
    const viewStudentId = searchParams.get('view');
    if (viewStudentId) {
      setSelectedStudentId(viewStudentId);
      setIsViewModalOpen(true);
    }
  }, [searchParams]);

  const handleStudentAdded = () => {
    // Increment the counter to trigger a refresh in the table
    setRefreshCounter(prev => prev + 1);
  };

  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
    setSelectedStudentId(null);
    // Remove the view parameter from URL
    router.push('/dashboard/students');
  };

  const handleStudentUpdated = () => {
    setRefreshCounter(prev => prev + 1);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Student Management</h1>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Student
        </Button>
      </div>
      
      <StudentsTable onRefresh={refreshCounter} />
      
      <AddStudentModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onStudentAdded={handleStudentAdded}
      />

      {/* View Student Modal */}
      <ViewStudentModal 
        isOpen={isViewModalOpen}
        onClose={handleCloseViewModal}
        studentId={selectedStudentId}
        onStudentUpdated={handleStudentUpdated}
      />
    </div>
  );
} 