'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Button, Card, CardContent } from '@altitutor/ui';
import { SlidersHorizontal } from 'lucide-react';
import { AdminPageActions } from '@/shared/components/AdminPageActions';
import { DashboardCardHeader } from '@/shared/components/DashboardCardHeader';
import { useCurrentStaff } from '@/shared/hooks';
import { TodaySessionsCalendarView } from '@/features/sessions/components/TodaySessionsCalendarView';
import { DashboardUpdatesCard } from '@/features/sessions/components/DashboardUpdatesCard';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { TasksList } from '@/features/tasks/components/TasksList';
import { IssuesList } from '@/features/issues/components/IssuesList';
import { ProjectsList } from '@/features/projects/components/ProjectsList';
import { DashboardReconciliationCard } from '@/features/reconciliation/components/DashboardReconciliationCard';
import { DashboardReportsCard } from '@/features/reports/components/DashboardReportsCard';
import { utcToAdelaideDate } from '@/features/bookings/utils/dateTimeHelpers';
import { DashboardLayoutDialog } from '@/features/dashboard/DashboardLayoutDialog';
import { DEFAULT_DASHBOARD_LAYOUT, dashboardLayoutSchema, type DashboardWidget } from '@/features/dashboard/layout';

const widgetWidths = { standard: '', wide: 'lg:col-span-2', full: 'lg:col-span-3' };
const issueFilters = { status: ['open'] };

async function requestLayout(layout?: DashboardWidget[]) {
  const response = await fetch('/api/dashboard/preferences', layout === undefined ? undefined : {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(layout),
  });
  if (!response.ok) throw new Error(layout ? 'Could not save your layout. Please try again.' : 'Could not load your saved dashboard layout.');
  return dashboardLayoutSchema.parse((await response.json()).layout);
}

export default function DashboardPage() {
  const { data: staff } = useCurrentStaff();
  const queryClient = useQueryClient();
  const queryKey = ['dashboard-layout', staff?.id];
  const preferences = useQuery({ queryKey, queryFn: () => requestLayout(), enabled: !!staff?.id });
  const layout = preferences.data ?? DEFAULT_DASHBOARD_LAYOUT;
  const [draft, setDraft] = useState<DashboardWidget[] | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: requestLayout,
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKey, saved);
      setDraft(null);
    },
  });

  const date = format(utcToAdelaideDate(new Date().toISOString()), 'yyyy-MM-dd');
  const openCustomization = () => {
    save.reset();
    setDraft(layout);
  };

  const renderWidget = (id: DashboardWidget['id']) => {
    switch (id) {
      case 'sessions':
        return <Card className="overflow-hidden">
          <DashboardCardHeader title="Sessions today" href={`/sessions?view=calendar&calendarMode=day&date=${date}`} linkLabel="Sessions" />
          <CardContent className="overflow-auto p-0"><TodaySessionsCalendarView date={date} onOpenSession={setSessionId} /></CardContent>
        </Card>;
      case 'updates':
        return <DashboardUpdatesCard date={date} onOpenSession={setSessionId} />;
      case 'reconciliation':
        return <DashboardReconciliationCard />;
      case 'reports':
        return <DashboardReportsCard />;
      case 'tasks':
        return <Card className="flex max-h-[520px] flex-col overflow-hidden">
          <DashboardCardHeader title="Tasks" href="/tasks" />
          <CardContent className="min-h-0 flex-1 p-0">
            <TasksList key={staff?.id ?? 'staff-loading'} defaultFilters={{ status: ['todo', 'in_progress'], ...(staff?.id ? { assignee: [staff.id] } : {}) }}
              hideToolbar embedView={{ groupBy: 'status', sortBy: 'priority', sortDirection: 'asc' }}
              showAssigneePill={false} showIssuePill={false} showProjectPill={false} showLinkPill={false} compact />
          </CardContent>
        </Card>;
      case 'issues':
        return <Card className="flex max-h-[520px] flex-col overflow-hidden">
          <DashboardCardHeader title="Issues" href="/issues" />
          <CardContent className="min-h-0 flex-1 p-0">
            <IssuesList defaultFilters={issueFilters} hideToolbar embedView={{ sortBy: 'due_date', sortDirection: 'asc' }} compact />
          </CardContent>
        </Card>;
      case 'projects':
        return <Card className="flex max-h-[520px] flex-col overflow-hidden">
          <DashboardCardHeader title="Projects" href="/projects" />
          <CardContent className="min-h-0 flex-1 p-0">
            <ProjectsList key={staff?.id ?? 'staff-loading'} defaultFilters={{ status: ['backlog', 'planned', 'in_progress'], ...(staff?.id ? { member: [staff.id] } : {}) }}
              hideToolbar embedView={{ sortBy: 'priority', sortDirection: 'asc', secondarySortBy: 'target_date' }} compact />
          </CardContent>
        </Card>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <AdminPageActions>
        <Button variant="outline" disabled={!preferences.data} onClick={openCustomization}>
          <SlidersHorizontal /> Customize dashboard
        </Button>
      </AdminPageActions>
      {preferences.isError && <div role="alert" className="flex items-center gap-2 text-sm">
        {preferences.error.message}
        <Button variant="ghost" size="sm" onClick={() => void preferences.refetch()}>Retry</Button>
      </div>}
      {layout.length ? (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          {layout.map(({ id, width }) => (
            <section key={id} className={`min-w-0 ${widgetWidths[width]}`}>{renderWidget(id)}</section>
          ))}
        </div>
      ) : <p className="text-sm text-muted-foreground">Your dashboard is empty. Customize it to add widgets.</p>}
      {sessionId && <SessionModal isOpen sessionId={sessionId} onClose={() => setSessionId(null)} />}
      {draft && (
        <DashboardLayoutDialog layout={draft} onChange={setDraft} onClose={() => setDraft(null)}
          onSave={() => save.mutate(draft)} saving={save.isPending} error={save.error?.message ?? null} />
      )}
    </div>
  );
}
