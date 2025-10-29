'use client';

import { Suspense, useState, useEffect } from 'react';
import { SessionsTable } from '@/features/sessions';
import { SessionsCalendarView } from '@/features/sessions';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { ViewTopicModal, FilePreviewModal } from '@/features/topics';
import { Button, Input, Tabs, TabsList, TabsTrigger } from '@altitutor/ui';
import { useSearchParams, useRouter } from 'next/navigation';
import { usePrecreateSessions } from '@/features/sessions';
import { addDays, format } from 'date-fns';

export default function SessionsPage() {
  const search = useSearchParams();
  const router = useRouter();
  const viewParam = search.get('view') || 'table';
  const [day, setDay] = useState<string>(new Date().toISOString().slice(0, 10));
  const { mutate: precreate } = usePrecreateSessions();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  const setView = (v: 'table' | 'calendar') => {
    const params = new URLSearchParams(search.toString());
    params.set('view', v);
    router.push(`/admin/dashboard/sessions?${params.toString()}`);
  };

  // Auto-precreate for the selected day
  useEffect(() => {
    if (!day) return;
    precreate({ start_date: day, end_date: day });
  }, [day]);

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
        <Tabs value={viewParam} onValueChange={(v) => setView(v as any)}>
          <TabsList>
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {viewParam === 'table' && (
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-sm mb-1">Date</label>
            <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDay(format(addDays(new Date(day), -1), 'yyyy-MM-dd'))}>Prev</Button>
            <Button variant="outline" onClick={() => setDay(new Date().toISOString().slice(0, 10))}>Today</Button>
            <Button variant="outline" onClick={() => setDay(format(addDays(new Date(day), 1), 'yyyy-MM-dd'))}>Next</Button>
          </div>
        </div>
      )}

      <Suspense>
        {viewParam === 'table' ? (
          <SessionsTable 
            rangeStart={day} 
            rangeEnd={day}
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


