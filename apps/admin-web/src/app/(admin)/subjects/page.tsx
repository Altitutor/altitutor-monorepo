'use client';
import { AdminPageActions } from '@/shared/components/AdminPageActions';

import { useState, useEffect } from 'react';
import { SubjectsTable, AddSubjectModal, ViewSubjectModal } from '@/features/subjects';
import { AdminPageActionButton } from '@/shared/components';
import { Plus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

export default function SubjectsPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [viewSubjectId, setViewSubjectId] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (viewParam) {
      setViewSubjectId(viewParam);
    }
  }, [searchParams]);

  const handleSubjectAdded = () => {
    setRefreshCounter(prev => prev + 1);
  };

  const handleViewModalClose = () => {
    setViewSubjectId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('view');
    window.history.pushState({}, '', url);
  };

  return (
    <div className="p-6">
      <AdminPageActions>

        <AdminPageActionButton
          icon={<Plus className="h-4 w-4" />}
          label="Add Subject"
          onClick={() => setIsAddModalOpen(true)}
        />
      </AdminPageActions>

      <SubjectsTable
        onRefresh={refreshCounter}
        onViewSubject={setViewSubjectId}
      />

      <AddSubjectModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubjectAdded={handleSubjectAdded}
      />

      <ViewSubjectModal
        isOpen={!!viewSubjectId}
        subjectId={viewSubjectId}
        onClose={handleViewModalClose}
        onSubjectUpdated={handleSubjectAdded}
      />
    </div>
  );
}

