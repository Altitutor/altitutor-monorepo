'use client';

import { Suspense, useState } from 'react';
import { TutorLogsTable } from '@/features/tutor-logs/components/TutorLogsTable';
import { AdminPageActionButton } from '@/shared/components';
import { LogSessionModal } from '@/features/tutor-logs';
import { QuickBooksExportModal } from '@/features/tutor-logs/components/QuickBooksExportModal';
import { Plus, Download } from 'lucide-react';
import { useCurrentStaff } from '@/shared/hooks';
import { useEntityModals } from '@/shared/contexts/EntityModalContext';

export default function TutorLogsPage() {
  const entityModals = useEntityModals();
  const [tutorLogModalOpen, setTutorLogModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Get current staff for tutor log modal
  const { data: currentStaff } = useCurrentStaff();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Tutor logs</h1>
        <div className="flex items-center gap-2">
          <AdminPageActionButton
            variant="outline"
            icon={<Download className="h-4 w-4" />}
            label="Export"
            onClick={() => setExportModalOpen(true)}
          />
          <AdminPageActionButton
            icon={<Plus className="h-4 w-4" />}
            label="Add tutor log"
            onClick={() => setTutorLogModalOpen(true)}
          />
        </div>
      </div>

      <Suspense>
        <TutorLogsTable 
          onOpenSession={(id) => entityModals.openSession(id as string)}
          onOpenStaff={(id) => entityModals.openStaff(id as string)}
        />
      </Suspense>

      {currentStaff && (
        <LogSessionModal
          isOpen={tutorLogModalOpen}
          onClose={() => {
            setTutorLogModalOpen(false);
          }}
          currentStaffId={currentStaff.id}
          adminMode={true}
        />
      )}
      
      <QuickBooksExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
      />
    </div>
  );
}
