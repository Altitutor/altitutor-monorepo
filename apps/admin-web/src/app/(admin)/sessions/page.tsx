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
  
  // Initialize day from URL param or default to today
  const dateParam = search.get('date');
  const initialDate = isValidDateString(dateParam) 
    ? dateParam! 
    : getTodayLocalDate();
  
  const [day, setDay] = useState<string>(initialDate);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  // Sync day state with URL param when it changes
  useEffect(() => {
    const dateParam = search.get('date');
    if (isValidDateString(dateParam) && dateParam !== day) {
      setDay(dateParam!);
    } else if (!dateParam && day !== getTodayLocalDate()) {
      // If no date param and day is not today, reset to today
      const today = getTodayLocalDate();
      setDay(today);
    }
  }, [search, day]);

  const setView = (v: 'table' | 'calendar') => {
    const params = new URLSearchParams(search.toString());
    params.set('view', v);
    router.push(`/sessions?${params.toString()}`);
  };

  // Handle date change and update URL
  const handleDateChange = (newDate: string) => {
    if (!isValidDateString(newDate)) {
      // Fallback to today if invalid
      const today = getTodayLocalDate();
      setDay(today);
      const params = new URLSearchParams(search.toString());
      params.set('view', 'table');
      params.set('date', today);
      router.push(`/sessions?${params.toString()}`);
      return;
    }
    
    setDay(newDate);
    const params = new URLSearchParams(search.toString());
    params.set('view', 'table');
    params.set('date', newDate);
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
            rangeStart={day} 
            rangeEnd={day}
            date={day}
            onDateChange={handleDateChange}
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
    </div>
  );
}


