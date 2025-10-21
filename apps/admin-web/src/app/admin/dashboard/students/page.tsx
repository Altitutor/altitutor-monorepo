'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { StudentsTable, AddStudentModal, ViewStudentModal } from '@/features/students';
import { Button } from '@altitutor/ui';
import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';

export default function StudentsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  useEffect(() => {
    const viewStudentId = searchParams.get('view');
    if (viewStudentId) {
      setSelectedStudentId(viewStudentId);
      setIsViewModalOpen(true);
    }
  }, [searchParams]);

  const handleStudentAdded = () => {
    setRefreshCounter(prev => prev + 1);
  };

  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
    setSelectedStudentId(null);
    router.push('/admin/dashboard/students');
  };

  const handleStudentUpdated = () => {
    setRefreshCounter(prev => prev + 1);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/dashboard">
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

      <ViewStudentModal 
        isOpen={isViewModalOpen}
        onClose={handleCloseViewModal}
        studentId={selectedStudentId}
        onStudentUpdated={handleStudentUpdated}
      />
    </div>
  );
}


