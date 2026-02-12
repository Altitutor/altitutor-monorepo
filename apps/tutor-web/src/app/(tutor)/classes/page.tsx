'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { FileText } from 'lucide-react';
import { TutorClassesTable } from '@/features/classes/components/TutorClassesTable';
import { SessionsCalendarView } from '@/features/sessions/components/SessionsCalendarView';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { LogSessionModal } from '@/features/tutor-logs/components/LogSessionModal';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';

export default function ClassesPage() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isLogSessionModalOpen, setIsLogSessionModalOpen] = useState(false);
  const [logSessionPreselectedId, setLogSessionPreselectedId] = useState<string | undefined>(
    undefined
  );
  const [logSessionCompletedCount, setLogSessionCompletedCount] = useState(0);
  const { data: currentStaff } = useCurrentStaff();

  const handleOpenSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsSessionModalOpen(true);
  };

  const handleCloseSessionModal = () => {
    setIsSessionModalOpen(false);
    setTimeout(() => setSelectedSessionId(null), 300);
  };

  const handleOpenLogSession = (preselectedSessionId?: string) => {
    setLogSessionPreselectedId(preselectedSessionId);
    setIsLogSessionModalOpen(true);
  };

  const handleCloseLogSession = () => {
    const hadPreselected = !!logSessionPreselectedId;
    setIsLogSessionModalOpen(false);
    setLogSessionPreselectedId(undefined);
    if (hadPreselected) {
      setLogSessionCompletedCount((c) => c + 1);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Classes</h1>
            <p className="text-muted-foreground mt-1">
              View your assigned classes and sessions
            </p>
          </div>
          {currentStaff?.id && (
            <Button
              onClick={() => handleOpenLogSession()}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Submit Tutor Log
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-8">
        {/* Classes Section */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Classes</h2>
          <TutorClassesTable />
        </div>

        {/* Timetable Section */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Timetable</h2>
          <SessionsCalendarView onOpenSession={handleOpenSession} />
        </div>
      </div>

      {/* Session Modal */}
      <SessionModal
        isOpen={isSessionModalOpen}
        sessionId={selectedSessionId}
        onClose={handleCloseSessionModal}
        onLogSessionClick={() => handleOpenLogSession(selectedSessionId ?? undefined)}
        currentStaffId={currentStaff?.id ?? null}
        currentStaffIdForNotes={currentStaff?.id ?? null}
        refreshTrigger={logSessionCompletedCount}
      />

      {/* Log Session Modal - composed at app level */}
      {currentStaff?.id && (
        <LogSessionModal
          isOpen={isLogSessionModalOpen}
          onClose={handleCloseLogSession}
          currentStaffId={currentStaff.id}
          preselectedSessionId={logSessionPreselectedId}
        />
      )}
    </div>
  );
}
