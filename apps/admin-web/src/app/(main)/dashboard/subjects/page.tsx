'use client';

import { useState, useEffect } from 'react';
import { SubjectsTable, AddSubjectModal, ViewSubjectModal } from '@/features/subjects';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function SubjectsPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [viewSubjectId, setViewSubjectId] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for view parameter in URL
    const viewParam = searchParams.get('view');
    if (viewParam) {
      setViewSubjectId(viewParam);
    }
  }, [searchParams]);

  const handleSubjectAdded = () => {
    // Increment the counter to trigger a refresh in the table
    setRefreshCounter(prev => prev + 1);
  };

  const handleViewModalClose = () => {
    setViewSubjectId(null);
    // Remove the view parameter from the URL without a full page reload
    const url = new URL(window.location.href);
    url.searchParams.delete('view');
    window.history.pushState({}, '', url);
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
          <h1 className="text-3xl font-bold tracking-tight">Subjects</h1>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Subject
        </Button>
      </div>
      
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