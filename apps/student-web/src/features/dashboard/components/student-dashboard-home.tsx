'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  addDays,
  format,
  isSameDay,
} from 'date-fns';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CalendarDays,
  CreditCard,
  Settings,
  Sparkles,
  User,
  type LucideIcon,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@altitutor/ui';
import type { StudentSessionWithStaff } from '@/shared/api/sessions';
import { useStudentSessions } from '@/shared/hooks/useStudentSessions';
import { StudentSessionsCard } from '@/shared/components/StudentSessionsCard';
import { StudentPageContainer } from '@/shared/components/layouts';
import { studentCardCn } from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';

const SESSION_RANGE_DAYS = 56;

type QuickLinkItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accentClass: string;
};

const quickLinks: QuickLinkItem[] = [
  {
    title: 'Classes & timetable',
    description: 'Enrolments, calendar, and session tools',
    href: '/classes',
    icon: Calendar,
    accentClass:
      'bg-brand-darkBlue/10 text-brand-darkBlue dark:bg-brand-lightBlue/15 dark:text-brand-lightBlue',
  },
  {
    title: 'Resources',
    description: 'Subject notes, topics, and files',
    href: '/resources',
    icon: BookOpen,
    accentClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  {
    title: 'Billing',
    description: 'Subscriptions, invoices, and payment methods',
    href: '/billing',
    icon: CreditCard,
    accentClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
  {
    title: 'My profile',
    description: 'Personal details and preferences',
    href: '/my-profile',
    icon: User,
    accentClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  {
    title: 'Settings',
    description: 'Account and notification settings',
    href: '/settings',
    icon: Settings,
    accentClass: 'bg-amber-500/10 text-amber-800 dark:text-amber-300',
  },
];

function DashboardSessionsSkeleton() {
  return (
    <Card className={studentCardCn('overflow-hidden')}>
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full max-w-md" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

export interface StudentDashboardHomeProps {
  firstName: string | null;
}

export function StudentDashboardHome({ firstName }: StudentDashboardHomeProps) {
  const today = useMemo(() => new Date(), []);
  const rangeStart = format(today, 'yyyy-MM-dd');
  const rangeEnd = format(addDays(today, SESSION_RANGE_DAYS), 'yyyy-MM-dd');

  const { data: sessions, isLoading, isError } = useStudentSessions(rangeStart, rangeEnd);

  const { todaysSessions, nextSession } = useMemo((): {
    todaysSessions: StudentSessionWithStaff[];
    nextSession: StudentSessionWithStaff | undefined;
  } => {
    if (!sessions?.length) {
      return { todaysSessions: [], nextSession: undefined };
    }

    const sorted = [...sessions].sort(
      (a, b) =>
        new Date(a.start_at ?? 0).getTime() - new Date(b.start_at ?? 0).getTime(),
    );

    const todays = sorted.filter(
      (s) => s.start_at && isSameDay(new Date(s.start_at), today),
    );

    const nowMs = Date.now();
    const next = sorted.find((s) => s.start_at && new Date(s.start_at).getTime() > nowMs);

    return { todaysSessions: todays, nextSession: next };
  }, [sessions, today]);

  const displayName = firstName?.trim() || 'Student';
  const weekday = format(today, 'EEEE');
  const dateLabel = format(today, 'd MMMM yyyy');

  const showToday = todaysSessions.length > 0;
  const primarySessions = showToday ? todaysSessions : nextSession ? [nextSession] : [];

  return (
    <div className="min-h-full">
      <StudentPageContainer className="space-y-8">
        <header className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Hi, {displayName}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">{dateLabel}</p>
          </div>
          <p className="text-muted-foreground max-w-2xl text-pretty">
            Welcome to Altitutor Student.
          </p>
        </header>

        <section aria-labelledby="sessions-heading" className="space-y-4">
          <div className="mb-4 flex items-center gap-2">
            <h2 id="sessions-heading" className="text-2xl font-semibold">
              Sessions
            </h2>
          </div>

          {isLoading ? (
            <DashboardSessionsSkeleton />
          ) : isError ? (
            <Card className={studentCardCn('bg-destructive/8 ring-destructive/25')}>
              <CardHeader>
                <CardTitle className="text-base">Could not load sessions</CardTitle>
                <CardDescription>
                  Refresh the page or open your timetable from Classes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" size="sm">
                  <Link href="/classes">Go to classes</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className={studentCardCn('overflow-hidden')}>
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-xl">
                      {showToday ? 'Today' : 'Next session'}
                    </CardTitle>
                    <CardDescription className="mt-1.5 max-w-xl">
                      {showToday
                        ? todaysSessions.length === 1
                          ? 'You have one session scheduled today.'
                          : `You have ${todaysSessions.length} sessions today.`
                        : nextSession
                          ? 'No sessions on your calendar for today — here is the next one.'
                          : 'No upcoming sessions in the next several weeks.'}
                    </CardDescription>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="shrink-0 rounded-xl border-0 bg-muted/80 shadow-sm ring-1 ring-black/[0.06] hover:bg-muted dark:ring-white/10"
                  >
                    <Link href="/classes" className="gap-2">
                      Full timetable
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {primarySessions.length > 0 ? (
                  <ul className="grid gap-3 sm:grid-cols-1">
                    {primarySessions.map((session) => (
                      <li key={session.session_id}>
                        <StudentSessionsCard
                          session={session}
                          staff={session.staff}
                          students={session.students}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-col items-start gap-4 rounded-2xl bg-muted/50 px-6 py-10 text-center ring-1 ring-black/[0.05] sm:items-center sm:text-center dark:ring-white/10">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Sparkles className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">You are all clear for now</p>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        When sessions are booked, they will show up here. Your class list
                        and calendar always live under Classes.
                      </p>
                    </div>
                    <Button asChild>
                      <Link href="/classes">View classes</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
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
                <li key={item.href}>
                  <Link href={item.href} className="group block h-full">
                    <Card
                      className={cn(
                        studentCardCn('h-full'),
                        'hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]',
                      )}
                    >
                      <div className="flex items-start gap-4 p-5">
                        <div
                          className={cn(
                            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-300',
                            item.accentClass,
                          )}
                        >
                          <Icon className="h-5 w-5" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5 pr-1">
                          <p className="text-base font-semibold leading-snug tracking-tight text-card-foreground transition-colors duration-300 group-hover:text-brand-darkBlue dark:group-hover:text-brand-lightBlue">
                            {item.title}
                          </p>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                        <ArrowRight
                          className={cn(
                            'mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-out',
                            'group-hover:translate-x-0.5 group-hover:text-foreground',
                          )}
                          aria-hidden
                        />
                      </div>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </StudentPageContainer>
    </div>
  );
}
