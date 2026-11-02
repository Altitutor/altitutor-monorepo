'use client';
import { AdminPageActions } from '@/shared/components/AdminPageActions';

import { Suspense, useState } from 'react';
import { SessionsTable } from '@/features/sessions';
import {
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
import { useEntityNavigation } from '@/shared/contexts/EntityNavigation';

export default function SessionsPage() {
  const search = useSearchParams();
  const { openCheckInModal } = useQuickActions();
  const entityModals = useEntityNavigation();
  const [view, setView] = useAdminPageViewParam(['table', 'calendar'] as const, 'calendar');
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingSessionType, setBookingSessionType] = useState<'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW' | 'STAFF_INTERVIEW' | null>(null);

  return (
    <div className="p-6 space-y-4">
      <AdminPageActions>

        <div className="flex items-center gap-4">
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
      </AdminPageActions>

      <Suspense>
        <SessionsTable renderMode={view} toolbarView={{value:view,options:[{value:'table',label:'Table'},{value:'calendar',label:'Calendar'}],onChange:(next) => {if(next === 'table' || next === 'calendar') setView(next);}}}
          initialCalendarDate={search.get('date') ?? undefined}
          initialCalendarMode={(search.get('calendarMode') as 'day' | 'week' | null) ?? undefined}
          onOpenSession={(id) => entityModals.openSession(id)} onOpenStudent={(id) => entityModals.openStudent(id)} onOpenStaff={(id) => entityModals.openStaff(id)} />
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
