'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClassesTable } from '@/features/classes/components';
import { StudentSessionsCalendarView, LogAbsenceDialog } from '@/features/sessions/components';
import { BookDraftingSessionModal } from '@/features/bookings/components/BookDraftingSessionModal';
import { Button } from '@altitutor/ui';
import { PenTool, CalendarX } from 'lucide-react';

export default function ClassesPage() {
  const searchParams = useSearchParams();
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);

  // Check for URL param to open modal
  useEffect(() => {
    if (searchParams.get('book-drafting') === 'true') {
      setIsBookingModalOpen(true);
    }
  }, [searchParams]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Classes</h1>
            <p className="text-muted-foreground mt-1">
              View your enrolled classes and sessions
            </p>
          </div>
          <Button onClick={() => setIsBookingModalOpen(true)}>
            <PenTool className="mr-2 h-4 w-4" />
            Book a Drafting Session
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-8">
        {/* Classes Section */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Classes</h2>
          <ClassesTable />
        </div>

        {/* Timetable Section */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Timetable</h2>
          <StudentSessionsCalendarView />
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setIsAbsenceModalOpen(true)} variant="outline">
              <CalendarX className="mr-2 h-4 w-4" />
              Log Absence
            </Button>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      <BookDraftingSessionModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        onBookingCreated={() => {
          // Optionally refresh data or show notification
        }}
      />

      {/* Absence Logging Modal */}
      <LogAbsenceDialog
        isOpen={isAbsenceModalOpen}
        onClose={() => setIsAbsenceModalOpen(false)}
      />
    </div>
  );
}

