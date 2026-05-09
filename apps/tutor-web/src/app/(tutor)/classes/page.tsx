'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { FileText } from 'lucide-react';
import { TutorClassesTable } from '@/features/classes/components/TutorClassesTable';
import { SessionsCalendarView } from '@/features/sessions/components/SessionsCalendarView';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { LogSessionModal, UnloggedSessionsTableSection } from '@/features/tutor-logs/components';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { TutorPageContainer } from '@/shared/components/layouts';

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
    <div className="flex min-h-full flex-col">
      <TutorPageContainer className="flex flex-1 flex-col space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Classes</h1>
            <p className="mt-1 text-muted-foreground">View your assigned classes and sessions</p>
          </div>
          {currentStaff?.id && (
            <Button
              onClick={() => handleOpenLogSession()}
              className="flex items-center gap-2 rounded-xl shadow-sm"
            >
              <FileText className="h-4 w-4" />
              Submit Tutor Log
            </Button>
          )}
        </header>

        <section aria-labelledby="classes-heading" className="space-y-4">
          <h2 id="classes-heading" className="text-2xl font-semibold">
            Classes
          </h2>
          <TutorClassesTable />
        </section>

        <section aria-labelledby="timetable-heading" className="space-y-4">
          <h2 id="timetable-heading" className="text-2xl font-semibold">
            Timetable
          </h2>
          <SessionsCalendarView onOpenSession={handleOpenSession} />
        </section>

        {currentStaff?.id ? (
          <UnloggedSessionsTableSection
            staffId={currentStaff.id}
            onLogSession={handleOpenLogSession}
          />
        ) : null}
      </TutorPageContainer>

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
