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
  const { data: currentStaff } = useCurrentStaff();

  const handleOpenSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsSessionModalOpen(true);
  };

  const handleCloseSessionModal = () => {
    setIsSessionModalOpen(false);
    // Delay clearing sessionId to allow exit animation
    setTimeout(() => {
      setSelectedSessionId(null);
    }, 300);
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
              onClick={() => setIsLogSessionModalOpen(true)}
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
      />

      {/* Log Session Modal */}
      {currentStaff?.id && (
        <LogSessionModal
          isOpen={isLogSessionModalOpen}
          onClose={() => setIsLogSessionModalOpen(false)}
          currentStaffId={currentStaff.id}
        />
      )}
    </div>
  );
}
