'use client';

import { useState } from 'react';
import { TutorClassesTable } from '@/features/classes/components/TutorClassesTable';
import { SessionsCalendarView } from '@/features/sessions/components/SessionsCalendarView';
import { SessionModal } from '@/features/sessions/components/SessionModal';

export default function ClassesPage() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);

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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Classes</h1>
          <p className="text-muted-foreground mt-1">
            View your assigned classes and sessions
          </p>
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
    </div>
  );
}
