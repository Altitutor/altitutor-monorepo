'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClassesTable } from '@/features/classes/components';
import { StudentSessionsCalendarView, LogAbsenceDialog } from '@/features/sessions/components';
import { BookDraftingSessionModal } from '@/features/bookings/components/BookDraftingSessionModal';
import { CalendarSubscriptionDialog } from '@/features/calendar/components';
import { Button } from '@altitutor/ui';
import { PenTool, CalendarX, CalendarPlus } from 'lucide-react';
import { StudentPageContainer } from '@/shared/components/layouts';
import { studentBtnOutline, studentBtnPrimary } from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';

export default function ClassesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [isCalendarDialogOpen, setIsCalendarDialogOpen] = useState(false);
  const [linkedSessionId, setLinkedSessionId] = useState<string | null>(null);

  // Check for URL param to open modal
  useEffect(() => {
    if (searchParams.get('book-drafting') === 'true') {
      setIsBookingModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const sessionId = searchParams.get('session');
    if (!sessionId) return;

    setLinkedSessionId(sessionId);
    router.replace('/classes', { scroll: false });
  }, [router, searchParams]);

  return (
    <>
      <StudentPageContainer className="space-y-10 pb-10">
        <div id="tour-classes-header" className="pb-2">
          <h1 className="text-3xl font-bold tracking-tight">My Schedule</h1>
          <p className="mt-1 text-muted-foreground">View your Classes, Homework Help, and Sessions</p>
        </div>

        <div id="tour-classes-actions">
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
            <Button
              className={cn(studentBtnOutline, 'sm:w-auto')}
              onClick={() => setIsCalendarDialogOpen(true)}
              variant="outline"
            >
              <CalendarPlus className="mr-2 h-4 w-4" />
              Add to calendar
            </Button>
          </div>
        </div>

        <div id="tour-classes-enrolments">
          <h2 className="mb-4 text-2xl font-semibold">Scheduled offerings</h2>
          <ClassesTable />
        </div>

        <div>
          <h2 className="mb-4 text-2xl font-semibold">Timetable</h2>
          <StudentSessionsCalendarView
            linkedSessionId={linkedSessionId}
            onLinkedSessionHandled={() => setLinkedSessionId(null)}
          />
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

      <CalendarSubscriptionDialog
        open={isCalendarDialogOpen}
        onOpenChange={setIsCalendarDialogOpen}
      />
    </>
  );
}
