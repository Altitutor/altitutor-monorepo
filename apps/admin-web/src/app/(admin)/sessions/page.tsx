'use client';

import { Suspense, useState, useEffect } from 'react';
import { SessionsTable } from '@/features/sessions';
import { SessionsCalendarView } from '@/features/sessions';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { ViewTopicModal, FilePreviewModal } from '@/features/topics';
import { Tabs, TabsList, TabsTrigger, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@altitutor/ui';
import { useSearchParams, useRouter } from 'next/navigation';
import { BookSessionModal } from '@/features/bookings/components';
import { StaffInterviewBookSessionModal } from '@/features/bookings/components/staff-interview/StaffInterviewBookSessionModal';
import { CheckInBookSessionModal } from '@/features/sessions/components/CheckInBookSessionModal';
import { ChevronDown } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { sessionsKeys } from '@/features/sessions/hooks/useSessionsQuery';

export default function SessionsPage() {
  const search = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const viewParam = search.get('view') || 'calendar';
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingSessionType, setBookingSessionType] = useState<'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW' | 'STAFF_INTERVIEW' | null>(null);
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);

  const setView = (v: 'table' | 'calendar') => {
    const params = new URLSearchParams(search.toString());
    params.set('view', v);
    router.push(`/sessions?${params.toString()}`);
  };


  // Listen for events fired from SessionModal to open student/staff/topic/file modals
  useEffect(() => {
    const onOpenStudent = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string };
      if (detail?.id) setActiveStudentId(detail.id);
    };
    const onOpenStaff = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string };
      if (detail?.id) setActiveStaffId(detail.id);
    };
    const onOpenTopic = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string };
      if (detail?.id) setActiveTopicId(detail.id);
    };
    const onOpenFile = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string };
      if (detail?.id) setActiveFileId(detail.id);
    };
    
    const studentListener = onOpenStudent as EventListener;
    const staffListener = onOpenStaff as EventListener;
    const topicListener = onOpenTopic as EventListener;
    const fileListener = onOpenFile as EventListener;

    window.addEventListener('open-student-modal', studentListener);
    window.addEventListener('open-staff-modal', staffListener);
    window.addEventListener('open-topic-modal', topicListener);
    window.addEventListener('open-file-preview', fileListener);

    return () => {
      window.removeEventListener('open-student-modal', studentListener);
      window.removeEventListener('open-staff-modal', staffListener);
      window.removeEventListener('open-topic-modal', topicListener);
      window.removeEventListener('open-file-preview', fileListener);
    };
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Sessions</h1>
        <div className="flex items-center gap-4">
          <Tabs value={viewParam} onValueChange={(v) => setView(v as 'table' | 'calendar')}>
            <TabsList>
              <TabsTrigger value="table">Table</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
            </TabsList>
          </Tabs>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                Add meeting
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
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
                  setCheckInModalOpen(true);
                }}
              >
                Check in
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Suspense>
        {viewParam === 'table' ? (
          <SessionsTable 
            onOpenSession={(id) => setActiveSessionId(id as string)}
            onOpenStudent={(id) => setActiveStudentId(id as string)}
            onOpenStaff={(id) => setActiveStaffId(id as string)}
          />
        ) : (
          <SessionsCalendarView onOpenSession={(id) => setActiveSessionId(id as string)} />
        )}
      </Suspense>

      <SessionModal
        isOpen={!!activeSessionId}
        sessionId={activeSessionId}
        onClose={() => setActiveSessionId(null)}
      />

      <ViewStudentModal
        isOpen={!!activeStudentId}
        studentId={activeStudentId}
        onClose={() => setActiveStudentId(null)}
        onStudentUpdated={() => {}}
      />

      <ViewStaffModal
        isOpen={!!activeStaffId}
        staffId={activeStaffId}
        onClose={() => setActiveStaffId(null)}
        onStaffUpdated={() => {}}
      />

      <ViewTopicModal
        isOpen={!!activeTopicId}
        topicId={activeTopicId}
        onClose={() => setActiveTopicId(null)}
        onTopicUpdated={() => {}}
      />

      <FilePreviewModal
        isOpen={!!activeFileId}
        fileId={activeFileId}
        onClose={() => setActiveFileId(null)}
      />

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

      <CheckInBookSessionModal
        isOpen={checkInModalOpen}
        onClose={() => setCheckInModalOpen(false)}
        onCreated={(sessionId) => {
          void queryClient.invalidateQueries({ queryKey: sessionsKeys.all });
          setCheckInModalOpen(false);
          setActiveSessionId(sessionId);
        }}
      />
    </div>
  );
}

