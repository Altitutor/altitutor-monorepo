'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { StudentsTable, AddStudentModal, ViewStudentModal } from '@/features/students';
import { Button } from '@altitutor/ui';
import { Plus } from 'lucide-react';

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
    router.push('/students');
  };

  const handleStudentUpdated = () => {
    setRefreshCounter(prev => prev + 1);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Students</h1>
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


