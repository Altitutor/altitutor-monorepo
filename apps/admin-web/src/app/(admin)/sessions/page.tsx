'use client';

import { Suspense, useState, useEffect } from 'react';
import { SessionsTable } from '@/features/sessions';
import { SessionsCalendarView } from '@/features/sessions';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { ViewTopicModal, FilePreviewModal } from '@/features/topics';
import { Tabs, TabsList, TabsTrigger, useToast } from '@altitutor/ui';
import { useSearchParams, useRouter } from 'next/navigation';
import { isValid, parseISO } from 'date-fns';
import { DateRangePicker } from '@/shared/components/DateRangePicker';

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
  const initialFrom = isValidDateString(fromParam) ? fromParam! : getTodayLocalDate();
  const initialTo = isValidDateString(toParam) ? toParam! : getTodayLocalDate();
  
  const [from, setFrom] = useState<string>(initialFrom);
  const [to, setTo] = useState<string>(initialTo);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  // Sync date range state with URL params when they change
  useEffect(() => {
    const fromParam = search.get('from');
    const toParam = search.get('to');
    if (fromParam !== null) {
      if (isValidDateString(fromParam)) {
        if (fromParam !== from) {
          setFrom(fromParam);
        }
      } else if (fromParam === '' && from !== '') {
        setFrom('');
      }
    } else if (from !== getTodayLocalDate()) {
      // If no from param, default to today
      const today = getTodayLocalDate();
      setFrom(today);
    }
    
    if (toParam !== null) {
      if (isValidDateString(toParam)) {
        if (toParam !== to) {
          setTo(toParam);
        }
      } else if (toParam === '' && to !== '') {
        setTo('');
      }
    } else if (to !== getTodayLocalDate()) {
      // If no to param, default to today
      const today = getTodayLocalDate();
      setTo(today);
    }
  }, [search, from, to]);

  const setView = (v: 'table' | 'calendar') => {
    const params = new URLSearchParams(search.toString());
    params.set('view', v);
    router.push(`/sessions?${params.toString()}`);
  };

  // Handle date range changes and update URL
  const handleFromChange = (newFrom: string) => {
    if (!isValidDateString(newFrom)) {
      const today = getTodayLocalDate();
      setFrom(today);
      const params = new URLSearchParams(search.toString());
      params.set('view', 'table');
      params.set('from', today);
      params.set('to', to);
      router.push(`/sessions?${params.toString()}`);
      return;
    }
    
    setFrom(newFrom);
    const params = new URLSearchParams(search.toString());
    params.set('view', 'table');
    params.set('from', newFrom);
    params.set('to', to);
    router.push(`/sessions?${params.toString()}`);
  };

  const handleToChange = (newTo: string) => {
    if (!isValidDateString(newTo)) {
      const today = getTodayLocalDate();
      setTo(today);
      const params = new URLSearchParams(search.toString());
      params.set('view', 'table');
      params.set('from', from);
      params.set('to', today);
      router.push(`/sessions?${params.toString()}`);
      return;
    }
    
    setTo(newTo);
    const params = new URLSearchParams(search.toString());
    params.set('view', 'table');
    params.set('from', from);
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
    
    window.addEventListener('open-student-modal', onOpenStudent as any);
    window.addEventListener('open-staff-modal', onOpenStaff as any);
    window.addEventListener('open-topic-modal', onOpenTopic as any);
    window.addEventListener('open-file-preview', onOpenFile as any);
    
    return () => {
      window.removeEventListener('open-student-modal', onOpenStudent as any);
      window.removeEventListener('open-staff-modal', onOpenStaff as any);
      window.removeEventListener('open-topic-modal', onOpenTopic as any);
      window.removeEventListener('open-file-preview', onOpenFile as any);
    };
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Sessions</h1>
        <div className="flex items-center gap-4">
          <Tabs value={viewParam} onValueChange={(v) => setView(v as any)}>
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
    </div>
  );
}


