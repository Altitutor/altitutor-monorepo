'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClassesTable } from '@/features/classes/components';
import { StudentSessionsCalendarView, LogAbsenceDialog } from '@/features/sessions/components';
import { BookDraftingSessionModal } from '@/features/bookings/components/BookDraftingSessionModal';
import { Button } from '@altitutor/ui';
import { PenTool, CalendarX } from 'lucide-react';
import { StudentPageContainer } from '@/shared/components/layouts';
import { studentBtnOutline, studentBtnPrimary } from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';

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
        <div className="pb-2">
          <h1 className="text-3xl font-bold tracking-tight">My Classes</h1>
          <p className="mt-1 text-muted-foreground">View your enrolled classes and sessions</p>
        </div>

        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              className={cn(studentBtnPrimary, 'shrink-0 sm:w-auto')}
              onClick={() => setIsBookingModalOpen(true)}
            >
              <PenTool className="mr-2 h-4 w-4" />
              Book a Drafting Session
            </Button>
            <Button
              className={cn(studentBtnOutline, 'sm:w-auto')}
              onClick={() => setIsAbsenceModalOpen(true)}
              variant="outline"
            >
              <CalendarX className="mr-2 h-4 w-4" />
              Log Absence
            </Button>
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-2xl font-semibold">Classes</h2>
          <ClassesTable />
        </div>

        <div>
          <h2 className="mb-4 text-2xl font-semibold">Timetable</h2>
          <StudentSessionsCalendarView />
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

