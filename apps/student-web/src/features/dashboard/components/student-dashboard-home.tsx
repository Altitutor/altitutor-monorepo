'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { addDays, format } from 'date-fns';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CreditCard,
  Settings,
  User,
  type LucideIcon,
} from 'lucide-react';
import { Button, ClickableNavCard } from '@altitutor/ui';
import type { StudentSessionWithStaff } from '@/shared/api/sessions';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { StudentTodaySessionsCalendarView } from '@/features/sessions/components/StudentTodaySessionsCalendarView';
import { StudentDashboardRecentSessionsCard } from './StudentDashboardRecentSessionsCard';
import { StudentPageContainer } from '@/shared/components/layouts';
import { useStudentSessions } from '@/shared/hooks';
import { studentBtnOutline, studentCardCn } from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';

const SESSION_RANGE_DAYS = 56;
const SESSION_PAST_DAYS = 120;

type QuickLinkItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const quickLinks: QuickLinkItem[] = [
  {
    title: 'Classes & timetable',
    description: 'Enrolments, calendar, and session tools',
    href: '/classes',
    icon: Calendar,
  },
  {
    title: 'Resources',
    description: 'Subject notes, topics, and files',
    href: '/resources',
    icon: BookOpen,
  },
  {
    title: 'Billing',
    description: 'Subscriptions, invoices, and payment methods',
    href: '/billing',
    icon: CreditCard,
  },
  {
    title: 'My profile',
    description: 'Personal details and preferences',
    href: '/settings/profile',
    icon: User,
  },
  {
    title: 'Settings',
    description: 'Account and notification settings',
    href: '/settings',
    icon: Settings,
  },
];

function classGroupKey(session: StudentSessionWithStaff): string {
  return session.class_id ?? session.subject_id ?? session.session_id ?? '';
}

export interface StudentDashboardHomeProps {
  firstName: string | null;
}

export function StudentDashboardHome({ firstName }: StudentDashboardHomeProps) {
  const [dashboardSessionId, setDashboardSessionId] = useState<string | null>(null);
  const today = useMemo(() => new Date(), []);
  const todayStr = format(today, 'yyyy-MM-dd');
  const rangeStart = format(addDays(today, -SESSION_PAST_DAYS), 'yyyy-MM-dd');
  const rangeEnd = format(addDays(today, SESSION_RANGE_DAYS), 'yyyy-MM-dd');

  const { data: sessions, isLoading: sessionsLoading, isError: sessionsError } = useStudentSessions(
    rangeStart,
    rangeEnd,
  );

  const todaySessions = useMemo((): StudentSessionWithStaff[] => {
    if (!sessions?.length) return [];
    return sessions.filter((s) => s.session_id && s.start_at);
  }, [sessions]);

  const recentPerClassSessions = useMemo((): StudentSessionWithStaff[] => {
    if (!sessions?.length) return [];
    const nowMs = Date.now();
    const past = sessions.filter(
      (s) => s.start_at && new Date(s.start_at).getTime() < nowMs && s.session_id,
    );
    past.sort(
      (a, b) => new Date(b.start_at!).getTime() - new Date(a.start_at!).getTime(),
    );

    const byClass = new Map<string, StudentSessionWithStaff>();
    for (const s of past) {
      const key = classGroupKey(s);
      if (!key) continue;
      if (!byClass.has(key)) byClass.set(key, s);
    }

    return [...byClass.values()].sort(
      (a, b) => new Date(b.start_at!).getTime() - new Date(a.start_at!).getTime(),
    );
  }, [sessions]);

  const displayName = firstName?.trim() || 'Student';
  const dateLabel = format(today, 'd MMMM yyyy');

  const openSession = (sessionId: string) => {
    setDashboardSessionId(sessionId);
  };

  return (
    <div className="min-h-full">
      <StudentPageContainer className="space-y-8">
        <header className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Hi, {displayName}</h1>
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">{dateLabel}</p>
          </div>
          <p className="text-muted-foreground max-w-2xl text-pretty">Welcome to Altitutor Student.</p>
        </header>

        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-3">
          <section aria-labelledby="todays-sessions-heading" className="md:col-span-2">
            <div className={studentCardCn('flex flex-col overflow-hidden')}>
              <div className="flex flex-wrap items-end justify-between gap-3 px-4 pb-2 pt-3">
                <h2 id="todays-sessions-heading" className="text-lg font-semibold">
                  Today’s sessions
                </h2>
                <Button asChild variant="outline" size="sm" className={cn(studentBtnOutline, 'shrink-0')}>
                  <Link href="/classes" className="gap-2">
                    Timetable
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="max-h-[520px] min-h-0 overflow-auto">
                {sessionsError ? (
                  <p className="px-4 py-8 text-sm text-muted-foreground">
                    Could not load your sessions.{' '}
                    <Link href="/classes" className="font-medium text-foreground underline-offset-4 hover:underline">
                      Open timetable
                    </Link>
                  </p>
                ) : (
                  <StudentTodaySessionsCalendarView
                    date={todayStr}
                    sessions={todaySessions}
                    isLoading={sessionsLoading}
                    onOpenSession={openSession}
                  />
                )}
              </div>
            </div>
          </section>

          <StudentDashboardRecentSessionsCard
            sessions={recentPerClassSessions}
            isLoading={sessionsLoading}
            isError={sessionsError}
            onOpenSession={openSession}
          />
        </div>

        <section aria-labelledby="quick-links-heading" className="space-y-4">
          <div className="mb-4 flex items-center gap-2">
            <h2 id="quick-links-heading" className="text-2xl font-semibold">
              Quick links
            </h2>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href} className="flex min-w-0 flex-col">
                  <ClickableNavCard
                    href={item.href}
                    icon={Icon}
                    title={item.title}
                    description={item.description}
                    cardClassName={studentCardCn()}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      </StudentPageContainer>

      <SessionModal
        isOpen={dashboardSessionId !== null}
        sessionId={dashboardSessionId}
        onClose={() => setDashboardSessionId(null)}
      />
    </div>
  );
}
