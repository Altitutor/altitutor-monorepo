'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CreditCard,
  Settings,
  User,
  type LucideIcon,
} from 'lucide-react';
import { Button, ClickableNavCard, Skeleton } from '@altitutor/ui';
import { formatSessionDate } from '@altitutor/shared';
import type { StudentSessionWithStaff } from '@/shared/api/sessions';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { StudentSessionsCard } from '@/shared/components';
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

function SessionsBlockSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  );
}

function classGroupKey(session: StudentSessionWithStaff): string {
  return session.class_id ?? session.subject_id ?? session.session_id ?? '';
}

export interface StudentDashboardHomeProps {
  firstName: string | null;
}

export function StudentDashboardHome({ firstName }: StudentDashboardHomeProps) {
  const [dashboardSessionId, setDashboardSessionId] = useState<string | null>(null);
  const today = useMemo(() => new Date(), []);
  const rangeStart = format(addDays(today, -SESSION_PAST_DAYS), 'yyyy-MM-dd');
  const rangeEnd = format(addDays(today, SESSION_RANGE_DAYS), 'yyyy-MM-dd');

  const { data: sessions, isLoading: sessionsLoading, isError: sessionsError } = useStudentSessions(
    rangeStart,
    rangeEnd,
  );

  const upcomingSessionsForBlock = useMemo((): StudentSessionWithStaff[] => {
    if (!sessions?.length) return [];
    const nowMs = Date.now();
    const upcoming = sessions.filter(
      (s) => s.start_at && new Date(s.start_at).getTime() > nowMs && s.session_id,
    );
    if (!upcoming.length) return [];
    upcoming.sort(
      (a, b) => new Date(a.start_at!).getTime() - new Date(b.start_at!).getTime(),
    );
    const anchorDay = startOfDay(new Date(upcoming[0].start_at!));
    return upcoming.filter((s) => isSameDay(new Date(s.start_at!), anchorDay));
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

  const openSession = (sessionId: string | null | undefined) => {
    if (sessionId) setDashboardSessionId(sessionId);
  };

  return (
    <div className="min-h-full">
      <StudentPageContainer className="space-y-10">
        <header className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Hi, {displayName}</h1>
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">{dateLabel}</p>
          </div>
          <p className="text-muted-foreground max-w-2xl text-pretty">Welcome to Altitutor Student.</p>
        </header>

        <section aria-labelledby="next-session-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="next-session-heading" className="text-2xl font-semibold">
              Next session
            </h2>
            <Button asChild variant="outline" size="sm" className={cn(studentBtnOutline, 'shrink-0')}>
              <Link href="/classes" className="gap-2">
                Timetable
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {sessionsLoading ? (
            <SessionsBlockSkeleton rows={2} />
          ) : sessionsError ? (
            <p className="text-sm text-muted-foreground">
              Could not load your sessions.{' '}
              <Link href="/classes" className="font-medium text-foreground underline-offset-4 hover:underline">
                Open timetable
              </Link>
            </p>
          ) : upcomingSessionsForBlock.length > 0 ? (
            <div className="space-y-2">
              {upcomingSessionsForBlock.map((session) => (
                <StudentSessionsCard
                  key={session.session_id!}
                  session={session}
                  staff={session.staff}
                  students={session.students}
                  dateLabel={session.start_at ? formatSessionDate(session.start_at) : null}
                  onClick={() => openSession(session.session_id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No upcoming sessions in the next several weeks. Book or check your timetable under Classes.
            </p>
          )}
        </section>

        <section aria-labelledby="recent-sessions-heading" className="space-y-4">
          <h2 id="recent-sessions-heading" className="text-2xl font-semibold">
            Recent sessions
          </h2>

          {sessionsLoading ? (
            <SessionsBlockSkeleton rows={2} />
          ) : sessionsError ? (
            <p className="text-sm text-muted-foreground">Could not load your sessions.</p>
          ) : recentPerClassSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              When you have completed classes, your most recent session for each class will show here.
            </p>
          ) : (
            <div className="space-y-2">
              {recentPerClassSessions.map((session) => (
                <StudentSessionsCard
                  key={session.session_id!}
                  session={session}
                  staff={session.staff}
                  students={session.students}
                  dateLabel={session.start_at ? formatSessionDate(session.start_at) : null}
                  onClick={() => openSession(session.session_id)}
                />
              ))}
            </div>
          )}
        </section>

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
