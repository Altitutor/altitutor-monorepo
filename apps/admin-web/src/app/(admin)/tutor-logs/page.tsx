'use client';

import { Suspense, useState, useEffect } from 'react';
import { TutorLogsTable } from '@/features/tutor-logs/components/TutorLogsTable';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { ViewTopicModal, FilePreviewModal } from '@/features/topics';
import { Button } from '@altitutor/ui';
import { LogSessionModal } from '@/features/tutor-logs';
import { QuickBooksExportModal } from '@/features/tutor-logs/components/QuickBooksExportModal';
import { Plus, Download } from 'lucide-react';
import { useCurrentStaff } from '@/shared/hooks';

export default function TutorLogsPage() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [tutorLogModalOpen, setTutorLogModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Get current staff for tutor log modal
  const { data: currentStaff } = useCurrentStaff();

  // Listen for events fired from SessionModal to open student/staff/topic/file modals
  useEffect(() => {
    const onOpenStudent = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string };
      if (detail?.id) setActiveStudentId(detail.id);
    };
    const onOpenStaff = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string };
      if (detail?.id) setActiveStaffId(detail.id);
    };
    const onOpenTopic = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string };
      if (detail?.id) setActiveTopicId(detail.id);
    };
    const onOpenFile = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string };
      if (detail?.id) setActiveFileId(detail.id);
    };
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.addEventListener('open-student-modal', onOpenStudent as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.addEventListener('open-staff-modal', onOpenStaff as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.addEventListener('open-topic-modal', onOpenTopic as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.addEventListener('open-file-preview', onOpenFile as any);
    
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.removeEventListener('open-student-modal', onOpenStudent as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.removeEventListener('open-staff-modal', onOpenStaff as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.removeEventListener('open-topic-modal', onOpenTopic as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.removeEventListener('open-file-preview', onOpenFile as any);
    };
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Tutor logs</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setExportModalOpen(true)}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setTutorLogModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add tutor log
          </Button>
        </div>
      </div>

      <Suspense>
        <TutorLogsTable 
          onOpenSession={(id) => setActiveSessionId(id as string)}
          onOpenStaff={(id) => setActiveStaffId(id as string)}
        />
      </Suspense>

      <SessionModal
        isOpen={!!activeSessionId}
        sessionId={activeSessionId}
        onClose={() => setActiveSessionId(null)}
      />

      <ViewStudentModal
        isOpen={!!activeStudentId}
        studentId={activeStudentId}
        onClose={() => setActiveStudentId(null)}
        onStudentUpdated={() => {}}
      />

      <ViewStaffModal
        isOpen={!!activeStaffId}
        staffId={activeStaffId}
        onClose={() => setActiveStaffId(null)}
        onStaffUpdated={() => {}}
      />

      <ViewTopicModal
        isOpen={!!activeTopicId}
        topicId={activeTopicId}
        onClose={() => setActiveTopicId(null)}
        onTopicUpdated={() => {}}
      />

      <FilePreviewModal
        isOpen={!!activeFileId}
        fileId={activeFileId}
        onClose={() => setActiveFileId(null)}
      />

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
