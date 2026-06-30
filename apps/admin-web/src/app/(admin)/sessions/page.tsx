'use client';

import { Suspense, useState } from 'react';
import { SessionsTable } from '@/features/sessions';
import { SessionsCalendarView } from '@/features/sessions';
import {
  SegmentedControl,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import { AdminPageActionButton } from '@/shared/components';
import { useSearchParams } from 'next/navigation';
import { useAdminPageViewParam } from '@/shared/hooks/useAdminPageViewParam';
import { BookSessionModal } from '@/features/bookings/components';
import { StaffInterviewBookSessionModal } from '@/features/bookings/components/staff-interview/StaffInterviewBookSessionModal';
import { ChevronDown, Plus } from 'lucide-react';
import { useQuickActions } from '@/shared/contexts/QuickActionsContext';
import { useEntityModals } from '@/shared/contexts/EntityModalContext';

export default function SessionsPage() {
  const search = useSearchParams();
  const { openCheckInModal } = useQuickActions();
  const entityModals = useEntityModals();
  const [view, setView] = useAdminPageViewParam(['table', 'calendar'] as const, 'calendar');
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingSessionType, setBookingSessionType] = useState<'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW' | 'STAFF_INTERVIEW' | null>(null);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Sessions</h1>
        <div className="flex items-center gap-4">
          <SegmentedControl
            value={view}
            onValueChange={(v) => setView(v as 'table' | 'calendar')}
            options={[
              { value: 'table', label: 'Table' },
              { value: 'calendar', label: 'Calendar' },
            ]}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <AdminPageActionButton
                icon={<Plus className="h-4 w-4" />}
                label="Add meeting"
                trailingIcon={<ChevronDown className="h-4 w-4" />}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setBookingSessionType('TRIAL_SESSION');
                  setBookingModalOpen(true);
                }}
              >
                Trial session
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setBookingSessionType('SUBSIDY_INTERVIEW');
                  setBookingModalOpen(true);
                }}
              >
                Subsidy interview
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setBookingSessionType('DRAFTING');
                  setBookingModalOpen(true);
                }}
              >
                Drafting
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setBookingSessionType('STAFF_INTERVIEW');
                  setBookingModalOpen(true);
                }}
              >
                Staff interview
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  openCheckInModal();
                }}
              >
                Check in
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  openCheckInModal(null, 'ADMIN_MEETING');
                }}
              >
                Admin meeting
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Suspense>
        {view === 'table' ? (
          <SessionsTable 
            onOpenSession={(id) => entityModals.openSession(id as string)}
            onOpenStudent={(id) => entityModals.openStudent(id as string)}
            onOpenStaff={(id) => entityModals.openStaff(id as string)}
          />
        ) : (
          <SessionsCalendarView
            onOpenSession={(id) => entityModals.openSession(id as string)}
            initialDate={search.get('date') ?? undefined}
            initialViewMode={(search.get('calendarMode') as 'day' | 'week' | null) ?? undefined}
          />
        )}
      </Suspense>

      {bookingSessionType === 'STAFF_INTERVIEW' ? (
        <StaffInterviewBookSessionModal
          isOpen={bookingModalOpen}
          onClose={() => {
            setBookingModalOpen(false);
            setBookingSessionType(null);
          }}
          onBookingCreated={() => {
            setBookingModalOpen(false);
            setBookingSessionType(null);
          }}
        />
      ) : (
        bookingSessionType && (
          <BookSessionModal
            isOpen={bookingModalOpen}
            onClose={() => {
              setBookingModalOpen(false);
              setBookingSessionType(null);
            }}
            sessionType={bookingSessionType}
            onBookingCreated={() => {
              setBookingModalOpen(false);
              setBookingSessionType(null);
            }}
          />
        )
      )}

    </div>
  );
}
