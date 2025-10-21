'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { StaffTable, AddStaffModal, ViewStaffModal } from '@/features/staff';
import { Button } from '@altitutor/ui';
import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';

export default function StaffPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  useEffect(() => {
    const viewStaffId = searchParams.get('view');
    if (viewStaffId) {
      setSelectedStaffId(viewStaffId);
      setIsViewModalOpen(true);
    }
  }, [searchParams]);

  const handleStaffAdded = () => {
    setRefreshCounter(prev => prev + 1);
  };

  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
    setSelectedStaffId(null);
    router.push('/admin/dashboard/staff');
  };

  const handleStaffUpdated = () => {
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
          <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Staff
        </Button>
      </div>
      
      <StaffTable onRefresh={refreshCounter} />
      
      <AddStaffModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onStaffAdded={handleStaffAdded}
      />

      <ViewStaffModal 
        isOpen={isViewModalOpen}
        onClose={handleCloseViewModal}
        staffId={selectedStaffId}
        onStaffUpdated={handleStaffUpdated}
      />
    </div>
  );
}


