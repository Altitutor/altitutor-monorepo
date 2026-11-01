"use client";

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { StudentsTable, AddStudentModal } from '@/features/students';
import { OnlineStudentsTable } from '@/features/students/components/OnlineStudentsTable';
import { STUDENT_VIEW_DEFAULTS } from '@/features/students/hooks/useStudentViews';
import { TrialStudentsPage } from '@/features/onboarding/components/TrialStudentsPage';
import { AdminPageActionButton } from '@/shared/components';
import { AdminPageActions } from '@/shared/components/AdminPageActions';

export default function StudentsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const relationship = params.get('relationship') ?? 'in_person';
  const presetOnly = params.has('relationship') && Array.from(params.keys()).every(key => ['relationship', 'view'].includes(key));
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
  if (relationship === 'trial') return <TrialStudentsPage />;
  return (
    <div className="p-6">
      <AdminPageActions><AdminPageActionButton icon={<Plus className="h-4 w-4" />} label="Add Student" onClick={() => setAdding(true)} /></AdminPageActions>
      {relationship === 'online' ? <OnlineStudentsTable key="online" /> : <StudentsTable key="in_person" onRefresh={refresh} />}
      <AddStudentModal isOpen={adding} onClose={() => setAdding(false)} onStudentAdded={() => setRefresh(value => value + 1)} />
    </div>
  );
}
