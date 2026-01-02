'use client';

import { Suspense, useState, useEffect } from 'react';
import { SessionsTable } from '@/features/sessions';
import { SessionsCalendarView } from '@/features/sessions';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { ViewTopicModal, FilePreviewModal } from '@/features/topics';
import { Tabs, TabsList, TabsTrigger, useToast, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@altitutor/ui';
import { useSearchParams, useRouter } from 'next/navigation';
import { isValid, parseISO } from 'date-fns';
import { BookSessionModal } from '@/features/bookings/components';
import { Plus, ChevronDown } from 'lucide-react';

// Get today's date in local timezone (YYYY-MM-DD format)
const getTodayLocalDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Validate date string format (YYYY-MM-DD)
const isValidDateString = (dateString: string | null): boolean => {
  if (!dateString) return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;
  try {
    const date = parseISO(dateString);
    return isValid(date);
  } catch {
    return false;
  }
};

export default function SessionsPage() {
  const search = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const viewParam = search.get('view') || 'table';
  
  // Initialize date range from URL params or default to today
  const fromParam = search.get('from');
  const toParam = search.get('to');
  const initialFrom = fromParam === '' ? '' : (isValidDateString(fromParam) ? fromParam! : getTodayLocalDate());
  const initialTo = toParam === '' ? '' : (isValidDateString(toParam) ? toParam! : getTodayLocalDate());
  
  const [from, setFrom] = useState<string>(initialFrom);
  const [to, setTo] = useState<string>(initialTo);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingSessionType, setBookingSessionType] = useState<'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW' | null>(null);

  // Sync date range state with URL params when they change
  // Only sync from URL to state, don't force defaults after initial load
  useEffect(() => {
    const fromParam = search.get('from');
    const toParam = search.get('to');
    
    if (fromParam !== null) {
      if (isValidDateString(fromParam)) {
        setFrom(fromParam);
      } else if (fromParam === '') {
        setFrom('');
      }
    }
    // If fromParam is null, don't change state (allows cleared dates to stay cleared)
    
    if (toParam !== null) {
      if (isValidDateString(toParam)) {
        setTo(toParam);
      } else if (toParam === '') {
        setTo('');
      }
    }
    // If toParam is null, don't change state (allows cleared dates to stay cleared)
  }, [search]);

  const setView = (v: 'table' | 'calendar') => {
    const params = new URLSearchParams(search.toString());
    params.set('view', v);
    router.push(`/sessions?${params.toString()}`);
  };

  // Handle date range changes and update URL
  const handleFromChange = (newFrom: string) => {
    // Allow empty string to clear the filter
    if (newFrom === '') {
      setFrom('');
      const params = new URLSearchParams(search.toString());
      params.set('view', 'table');
      params.delete('from'); // Remove from URL when cleared
      params.set('to', to || '');
      router.push(`/sessions?${params.toString()}`);
      return;
    }
    
    if (!isValidDateString(newFrom)) {
      // Invalid date - don't update, keep current value
      return;
    }
    
    setFrom(newFrom);
    const params = new URLSearchParams(search.toString());
    params.set('view', 'table');
    params.set('from', newFrom);
    params.set('to', to || '');
    router.push(`/sessions?${params.toString()}`);
  };

  const handleToChange = (newTo: string) => {
    // Allow empty string to clear the filter
    if (newTo === '') {
      setTo('');
      const params = new URLSearchParams(search.toString());
      params.set('view', 'table');
      params.set('from', from || '');
      params.delete('to'); // Remove from URL when cleared
      router.push(`/sessions?${params.toString()}`);
      return;
    }
    
    if (!isValidDateString(newTo)) {
      // Invalid date - don't update, keep current value
      return;
    }
    
    setTo(newTo);
    const params = new URLSearchParams(search.toString());
    params.set('view', 'table');
    params.set('from', from || '');
    params.set('to', newTo);
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
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.addEventListener('open-student-modal', onOpenStudent as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.addEventListener('open-staff-modal', onOpenStaff as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.addEventListener('open-topic-modal', onOpenTopic as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.addEventListener('open-file-preview', onOpenFile as any);
    
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.removeEventListener('open-student-modal', onOpenStudent as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.removeEventListener('open-staff-modal', onOpenStaff as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.removeEventListener('open-topic-modal', onOpenTopic as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.removeEventListener('open-file-preview', onOpenFile as any);
    };
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Sessions</h1>
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
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
            </DropdownMenuContent>
          </DropdownMenu>
          <Tabs value={viewParam} onValueChange={(v) => setView(v as 'table' | 'calendar')}>
            <TabsList>
              <TabsTrigger value="table">Table</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <Suspense>
        {viewParam === 'table' ? (
          <SessionsTable 
            rangeStart={from} 
            rangeEnd={to}
            onOpenSession={(id) => setActiveSessionId(id as string)}
            onOpenStudent={(id) => setActiveStudentId(id as string)}
            onOpenStaff={(id) => setActiveStaffId(id as string)}
            onFromChange={handleFromChange}
            onToChange={handleToChange}
            onResetDates={() => {
              const today = getTodayLocalDate();
              handleFromChange(today);
              handleToChange(today);
            }}
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

      {bookingSessionType && (
        <BookSessionModal
          isOpen={bookingModalOpen}
          onClose={() => {
            setBookingModalOpen(false);
            setBookingSessionType(null);
          }}
          sessionType={bookingSessionType}
          onBookingCreated={() => {
            toast({
              title: 'Success',
              description: 'Session booked successfully',
            });
            // Optionally refresh the sessions list or navigate to the new session
            setBookingModalOpen(false);
            setBookingSessionType(null);
          }}
        />
      )}
    </div>
  );
}


