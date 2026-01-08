'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
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
  // Default both dates to today if not provided or invalid
  const initialFrom = (fromParam && isValidDateString(fromParam)) ? fromParam : getTodayLocalDate();
  const initialTo = (toParam && isValidDateString(toParam)) ? toParam : getTodayLocalDate();
  
  const [from, setFrom] = useState<string>(initialFrom);
  const [to, setTo] = useState<string>(initialTo);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingSessionType, setBookingSessionType] = useState<'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW' | null>(null);
  
  // Refs to store debounce timers
  const fromDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const toDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up empty date params from URL on mount
  useEffect(() => {
    const fromParam = search.get('from');
    const toParam = search.get('to');
    
    // If we have empty date params, clean them up and set to today
    if ((fromParam === '' || (fromParam && !isValidDateString(fromParam))) ||
        (toParam === '' || (toParam && !isValidDateString(toParam)))) {
      const params = new URLSearchParams(search.toString());
      const today = getTodayLocalDate();
      
      if (fromParam === '' || (fromParam && !isValidDateString(fromParam))) {
        params.set('from', today);
      }
      if (toParam === '' || (toParam && !isValidDateString(toParam))) {
        params.set('to', today);
      }
      
      router.replace(`/sessions?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Sync date range state with URL params when they change
  // Only sync from URL to state, don't force defaults after initial load
  // Skip syncing if we're currently debouncing to avoid conflicts
  useEffect(() => {
    // Don't sync if we have active debounce timers (user is typing)
    if (fromDebounceTimerRef.current || toDebounceTimerRef.current) {
      return;
    }
    
    const fromParam = search.get('from');
    const toParam = search.get('to');
    
    // Only sync valid dates from URL, default to today if missing or invalid
    // Note: search.get() returns null if param doesn't exist, empty string if param exists but is empty
    if (fromParam && fromParam !== '' && isValidDateString(fromParam)) {
      setFrom((prev) => prev !== fromParam ? fromParam : prev);
    } else {
      // If param is missing or empty, default to today
      const today = getTodayLocalDate();
      setFrom((prev) => prev !== today ? today : prev);
    }
    
    if (toParam && toParam !== '' && isValidDateString(toParam)) {
      setTo((prev) => prev !== toParam ? toParam : prev);
    } else {
      // If param is missing or empty, default to today
      const today = getTodayLocalDate();
      setTo((prev) => prev !== today ? today : prev);
    }
  }, [search]);

  const setView = (v: 'table' | 'calendar') => {
    const params = new URLSearchParams(search.toString());
    params.set('view', v);
    router.push(`/sessions?${params.toString()}`);
  };

  // Handle date range changes and update URL with debouncing
  const handleFromChange = (newFrom: string) => {
    // Clear any existing debounce timer
    if (fromDebounceTimerRef.current) {
      clearTimeout(fromDebounceTimerRef.current);
      fromDebounceTimerRef.current = null;
    }
    
    // Always update state immediately to allow partial input while typing
    // This prevents the controlled/uncontrolled input warning and keeps UI responsive
    setFrom(newFrom);
    
    // Debounce URL updates - only update URL after user stops typing
    fromDebounceTimerRef.current = setTimeout(() => {
      // Only update URL if the date is complete and valid
      if (isValidDateString(newFrom)) {
        const params = new URLSearchParams(search.toString());
        params.set('view', 'table');
        params.set('from', newFrom);
        // Always set 'to' to ensure it's in URL (defaults to today if not set)
        if (to && isValidDateString(to)) {
          params.set('to', to);
        } else {
          params.set('to', getTodayLocalDate());
        }
        router.replace(`/sessions?${params.toString()}`);
      }
      // If invalid/partial, don't update URL - just keep the state updated
      // The date input will handle validation visually
    }, 500); // 500ms debounce delay
  };

  const handleToChange = (newTo: string) => {
    // Clear any existing debounce timer
    if (toDebounceTimerRef.current) {
      clearTimeout(toDebounceTimerRef.current);
      toDebounceTimerRef.current = null;
    }
    
    // Always update state immediately to allow partial input while typing
    // This prevents the controlled/uncontrolled input warning and keeps UI responsive
    setTo(newTo);
    
    // Debounce URL updates - only update URL after user stops typing
    toDebounceTimerRef.current = setTimeout(() => {
      // Only update URL if the date is complete and valid
      if (isValidDateString(newTo)) {
        const params = new URLSearchParams(search.toString());
        params.set('view', 'table');
        // Always set 'from' to ensure it's in URL (defaults to today if not set)
        if (from && isValidDateString(from)) {
          params.set('from', from);
        } else {
          params.set('from', getTodayLocalDate());
        }
        params.set('to', newTo);
        router.replace(`/sessions?${params.toString()}`);
      }
      // If invalid/partial, don't update URL - just keep the state updated
      // The date input will handle validation visually
    }, 500); // 500ms debounce delay
  };
  
  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (fromDebounceTimerRef.current) {
        clearTimeout(fromDebounceTimerRef.current);
      }
      if (toDebounceTimerRef.current) {
        clearTimeout(toDebounceTimerRef.current);
      }
    };
  }, []);


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
          <Tabs value={viewParam} onValueChange={(v) => setView(v as 'table' | 'calendar')}>
            <TabsList>
              <TabsTrigger value="table">Table</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
            </TabsList>
          </Tabs>
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


