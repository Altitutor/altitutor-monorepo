'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ParentsTable, AddParentModal } from '@/features/parents';
import { ViewParentModal } from '@/features/students/components/ViewParentModal';
import { Button } from '@altitutor/ui';
import { Plus } from 'lucide-react';

export default function ParentsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  useEffect(() => {
    const viewParentId = searchParams.get('view');
    if (viewParentId) {
      setSelectedParentId(viewParentId);
      setIsViewModalOpen(true);
    }
  }, [searchParams]);

  const handleParentAdded = () => {
    setRefreshCounter(prev => prev + 1);
  };

  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
    setSelectedParentId(null);
    router.push('/parents');
  };

  const handleParentUpdated = () => {
    setRefreshCounter(prev => prev + 1);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Parents</h1>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Parent
        </Button>
      </div>
      
      <ParentsTable onRefresh={refreshCounter} />
      
      <AddParentModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onParentAdded={handleParentAdded}
      />

      <ViewParentModal 
        isOpen={isViewModalOpen}
        onClose={handleCloseViewModal}
        parentId={selectedParentId}
        onParentUpdated={handleParentUpdated}
      />
    </div>
  );
}

