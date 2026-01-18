'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { TutorLogsTable } from '@/features/tutor-logs/components/TutorLogsTable';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { ViewTopicModal, FilePreviewModal } from '@/features/topics';
import { Button } from '@altitutor/ui';
import { useSearchParams, useRouter } from 'next/navigation';
import { isValid, parseISO } from 'date-fns';
import { LogSessionModal } from '@/features/tutor-logs';
import { QuickBooksExportModal } from '@/features/tutor-logs/components/QuickBooksExportModal';
import { Plus, Download } from 'lucide-react';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';

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

export default function TutorLogsPage() {
  const search = useSearchParams();
  const router = useRouter();
  
  // Initialize date range from URL params or default to today
  const fromParam = search.get('from');
  const toParam = search.get('to');
  const initialFrom = (fromParam && isValidDateString(fromParam)) ? fromParam : getTodayLocalDate();
  const initialTo = (toParam && isValidDateString(toParam)) ? toParam : getTodayLocalDate();
  
  const [from, setFrom] = useState<string>(initialFrom);
  const [to, setTo] = useState<string>(initialTo);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [tutorLogModalOpen, setTutorLogModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  
  // Refs to store debounce timers
  const fromDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const toDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get current staff for tutor log modal
  const { data: currentStaff } = useCurrentStaff();

  // Clean up empty date params from URL on mount
  useEffect(() => {
    const fromParam = search.get('from');
    const toParam = search.get('to');
    
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
      
      router.replace(`/tutor-logs?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync date range state with URL params when they change
  useEffect(() => {
    if (fromDebounceTimerRef.current || toDebounceTimerRef.current) {
      return;
    }
    
    const fromParam = search.get('from');
    const toParam = search.get('to');
    
    if (fromParam && fromParam !== '' && isValidDateString(fromParam)) {
      setFrom((prev) => prev !== fromParam ? fromParam : prev);
    } else {
      const today = getTodayLocalDate();
      setFrom((prev) => prev !== today ? today : prev);
    }
    
    if (toParam && toParam !== '' && isValidDateString(toParam)) {
      setTo((prev) => prev !== toParam ? toParam : prev);
    } else {
      const today = getTodayLocalDate();
      setTo((prev) => prev !== today ? today : prev);
    }
  }, [search]);

  // Handle date range changes and update URL with debouncing
  const handleFromChange = (newFrom: string) => {
    if (fromDebounceTimerRef.current) {
      clearTimeout(fromDebounceTimerRef.current);
      fromDebounceTimerRef.current = null;
    }
    
    setFrom(newFrom);
    
    fromDebounceTimerRef.current = setTimeout(() => {
      if (isValidDateString(newFrom)) {
        const params = new URLSearchParams(search.toString());
        params.set('from', newFrom);
        if (to && isValidDateString(to)) {
          params.set('to', to);
        } else {
          params.set('to', getTodayLocalDate());
        }
        router.replace(`/tutor-logs?${params.toString()}`);
      }
    }, 500);
  };

  const handleToChange = (newTo: string) => {
    if (toDebounceTimerRef.current) {
      clearTimeout(toDebounceTimerRef.current);
      toDebounceTimerRef.current = null;
    }
    
    setTo(newTo);
    
    toDebounceTimerRef.current = setTimeout(() => {
      if (isValidDateString(newTo)) {
        const params = new URLSearchParams(search.toString());
        if (from && isValidDateString(from)) {
          params.set('from', from);
        } else {
          params.set('from', getTodayLocalDate());
        }
        params.set('to', newTo);
        router.replace(`/tutor-logs?${params.toString()}`);
      }
    }, 500);
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
        <h1 className="text-3xl font-bold tracking-tight">Tutor logs</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setExportModalOpen(true)}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setTutorLogModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add tutor log
          </Button>
        </div>
      </div>

      <Suspense>
        <TutorLogsTable 
          rangeStart={from} 
          rangeEnd={to}
          onOpenSession={(id) => setActiveSessionId(id as string)}
          onOpenStaff={(id) => setActiveStaffId(id as string)}
          onFromChange={handleFromChange}
          onToChange={handleToChange}
          onResetDates={() => {
            const today = getTodayLocalDate();
            handleFromChange(today);
            handleToChange(today);
          }}
        />
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

      {currentStaff && (
        <LogSessionModal
          isOpen={tutorLogModalOpen}
          onClose={() => {
            setTutorLogModalOpen(false);
          }}
          currentStaffId={currentStaff.id}
          adminMode={true}
        />
      )}
      
      <QuickBooksExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
      />
    </div>
  );
}


