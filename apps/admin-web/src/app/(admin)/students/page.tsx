"use client";

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { StudentsTable, AddStudentModal } from '@/features/students';
import { STUDENT_VIEW_DEFAULTS } from '@/features/students/hooks/useStudentViews';
import { NewJourney } from '@/features/onboarding/components/NewJourney';
import { AdminPageActionButton } from '@/shared/components';
import { AdminPageActions } from '@/shared/components/AdminPageActions';

export default function StudentsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const relationship = params.get('relationship') ?? 'in_person';
  const presetOnly = params.has('relationship') && Array.from(params.keys()).every(key => ['relationship', 'view'].includes(key));
  const [enquiry, setEnquiry] = useState(false);
  const [adding, setAdding] = useState(false);
  const [refresh, setRefresh] = useState(0);
  // Preserve old deep links while making the Student page the sole detail destination.
  const legacyStudentId = params.get('view');
  useEffect(() => {
    if (legacyStudentId && /^[\da-f-]{36}$/i.test(legacyStudentId)) router.replace(`/students/${legacyStudentId}`);
  }, [legacyStudentId, router]);
  useEffect(() => {
    if (!presetOnly) return;
    const key = relationship === 'online' || relationship === 'trial' ? relationship : 'in_person';
    const settings = STUDENT_VIEW_DEFAULTS[key];
    const next = new URLSearchParams({ sort: settings.sortBy ?? '__none__', order: settings.sortDirection, columns: settings.visibleColumns.join(',') });
    if (settings.groupBy) next.set('group', settings.groupBy);
    if (key === 'trial') next.set('view', params.get('view') === 'worklist' ? 'worklist' : 'board');
    Object.entries(settings.filters).forEach(([filter, values]) => next.set(filter, values.join(',')));
    router.replace(`/students?${next}`);
  }, [params, presetOnly, relationship, router]);
  if (presetOnly) return null;
  return (
    <div className="h-full min-h-0 overflow-hidden">
      <AdminPageActions><AdminPageActionButton icon={<Plus className="h-4 w-4" />} label="Add Student" onClick={() => setAdding(true)} /><AdminPageActionButton icon={<Plus className="h-4 w-4" />} label="New enquiry" onClick={() => setEnquiry(true)} /></AdminPageActions>
      <StudentsTable onRefresh={refresh} />
      {enquiry && <NewJourney onClose={() => setEnquiry(false)} />}
      <AddStudentModal isOpen={adding} onClose={() => setAdding(false)} onStudentAdded={() => setRefresh(value => value + 1)} />
    </div>
  );
}
