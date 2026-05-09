'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClassesTable } from '@/features/classes/components';
import { StudentSessionsCalendarView, LogAbsenceDialog } from '@/features/sessions/components';
import { BookDraftingSessionModal } from '@/features/bookings/components/BookDraftingSessionModal';
import { Button } from '@altitutor/ui';
import { PenTool, CalendarX } from 'lucide-react';
import { StudentPageContainer } from '@/shared/components/layouts';

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
    <>
      <StudentPageContainer className="space-y-10 pb-10">
        <div className="flex flex-col gap-8 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Classes</h1>
            <p className="mt-1 text-muted-foreground">View your enrolled classes and sessions</p>
          </div>
          <Button
            className="shrink-0 rounded-xl shadow-sm transition-all duration-300"
            onClick={() => setIsBookingModalOpen(true)}
          >
            <PenTool className="mr-2 h-4 w-4" />
            Book a Drafting Session
          </Button>
        </div>

        <div>
          <h2 className="mb-4 text-2xl font-semibold">Classes</h2>
          <ClassesTable />
        </div>

        <div>
          <h2 className="mb-4 text-2xl font-semibold">Timetable</h2>
          <StudentSessionsCalendarView />
          <div className="mt-4 flex justify-end">
            <Button
              className="rounded-xl transition-all duration-300"
              onClick={() => setIsAbsenceModalOpen(true)}
              variant="outline"
            >
              <CalendarX className="mr-2 h-4 w-4" />
              Log Absence
            </Button>
          </div>
        </div>
      </StudentPageContainer>

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
    </>
  );
}

