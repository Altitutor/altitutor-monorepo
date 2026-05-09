'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Calendar,
  Settings,
  User,
  type LucideIcon,
} from 'lucide-react';
import { Button, Card, Skeleton } from '@altitutor/ui';
import type { Database } from '@altitutor/shared';
import type { SessionStudent } from '@/features/sessions/utils/session-helpers';
import { TutorDashboardSessionCard } from './TutorDashboardSessionCard';
import {
  useTutorSessionDetailsBatch,
  useTutorSessionsInRange,
} from '@/features/sessions/hooks/useSessionsQuery';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { LogSessionModal, UnloggedSessionsTableSection } from '@/features/tutor-logs/components';
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess';
import { TutorPageContainer } from '@/shared/components/layouts';
import { tutorBtnOutline, tutorCardCn } from '@/shared/lib/tutor-visual';
import { cn } from '@/shared/utils';

const SESSION_RANGE_DAYS = 56;

type TutorSessionRow = Database['public']['Views']['vtutor_sessions']['Row'];
type TutorSessionWithId = TutorSessionRow & { session_id: string };

function DashboardSessionsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-36 shrink-0 rounded-xl" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    </div>
  );
}

type QuickLinkItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accentClass: string;
};

const baseQuickLinks: QuickLinkItem[] = [
  {
    title: 'Classes',
    description: 'Timetable, sessions, and tutor logs',
    href: '/classes',
    icon: Calendar,
    accentClass:
      'bg-brand-darkBlue/10 text-brand-darkBlue dark:bg-brand-lightBlue/15 dark:text-brand-lightBlue',
  },
  {
    title: 'Resources',
    description: 'Learning materials (coming soon)',
    href: '/resources',
    icon: BookOpen,
    accentClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  {
    title: 'Settings',
    description: 'Blockout dates and tutor preferences',
    href: '/settings',
    icon: Settings,
    accentClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
  {
    title: 'My profile',
    description: 'Details, availability, and account',
    href: '/my-profile',
    icon: User,
    accentClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
];

const ucatQuickLink: QuickLinkItem = {
  title: 'UCAT',
  description: 'Questions, sets, mocks, and student progress',
  href: '/ucat',
  icon: BrainCircuit,
  accentClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
};

export interface TutorDashboardHomeProps {
  firstName: string | null;
  staffId: string | null;
}

export function TutorDashboardHome({ firstName, staffId }: TutorDashboardHomeProps) {
  const ucatAccess = useUcatAccess();
  const displayName = firstName?.trim() || 'Tutor';

  const [isLogSessionModalOpen, setIsLogSessionModalOpen] = useState(false);
  const [logSessionPreselectedId, setLogSessionPreselectedId] = useState<string | undefined>(
    undefined,
  );
  const [logSessionCompletedCount, setLogSessionCompletedCount] = useState(0);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);

  const handleOpenLogSession = (preselectedSessionId?: string) => {
    setLogSessionPreselectedId(preselectedSessionId);
    setIsLogSessionModalOpen(true);
  };

  const handleCloseLogSession = () => {
    const hadPreselected = !!logSessionPreselectedId;
    setIsLogSessionModalOpen(false);
    setLogSessionPreselectedId(undefined);
    if (hadPreselected) {
      setLogSessionCompletedCount((c) => c + 1);
    }
  };

  const handleOpenSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsSessionModalOpen(true);
  };

  const handleCloseSessionModal = () => {
    setIsSessionModalOpen(false);
    setTimeout(() => setSelectedSessionId(null), 300);
  };

  const today = useMemo(() => new Date(), []);
  const rangeStart = format(today, 'yyyy-MM-dd');
  const rangeEnd = format(addDays(today, SESSION_RANGE_DAYS), 'yyyy-MM-dd');
  const dateLabel = format(today, 'd MMMM yyyy');

  const {
    data: sessions,
    isLoading: sessionsLoading,
    isError: sessionsError,
  } = useTutorSessionsInRange(rangeStart, rangeEnd);

  /** Same idea as student dashboard: first upcoming session defines the day; show all upcoming sessions that day. */
  const primarySessions = useMemo((): TutorSessionWithId[] => {
    if (!sessions?.length) return [];

    const withId = sessions.filter((s): s is TutorSessionWithId => Boolean(s.session_id));
    const nowMs = Date.now();
    const upcoming = withId.filter(
      (s) => s.start_at && new Date(s.start_at).getTime() > nowMs,
    );
    if (!upcoming.length) return [];

    upcoming.sort(
      (a, b) =>
        new Date(a.start_at ?? 0).getTime() - new Date(b.start_at ?? 0).getTime(),
    );

    const anchorDay = startOfDay(new Date(upcoming[0].start_at!));
    return upcoming.filter(
      (s) => s.start_at && isSameDay(new Date(s.start_at), anchorDay),
    );
  }, [sessions]);

  const detailIds = useMemo(() => primarySessions.map((s) => s.session_id), [primarySessions]);
  const { data: detailsMap } = useTutorSessionDetailsBatch(detailIds);

  const quickLinks = ucatAccess.data
    ? [baseQuickLinks[0], ucatQuickLink, ...baseQuickLinks.slice(1)]
    : baseQuickLinks;

  return (
    <>
    <div className="min-h-full">
      <TutorPageContainer className="space-y-8">
        <header className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Hi, {displayName}</h1>
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">{dateLabel}</p>
          </div>
          <p className="max-w-2xl text-pretty text-muted-foreground">
            Welcome to Altitutor Tutor — manage classes, materials, and your profile from here.
          </p>
        </header>

        <section aria-labelledby="next-session-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="next-session-heading" className="text-2xl font-semibold">
              Next session
            </h2>
            <Button
              asChild
              variant="outline"
              size="sm"
              className={cn(tutorBtnOutline, 'shrink-0')}
            >
              <Link href="/classes" className="gap-2">
                Timetable
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {sessionsLoading ? (
            <DashboardSessionsSkeleton />
          ) : sessionsError ? (
            <p className="text-sm text-muted-foreground">
              Could not load your sessions.{' '}
              <Link
                href="/classes"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Open timetable
              </Link>
            </p>
          ) : primarySessions.length > 0 ? (
            <div className="space-y-2">
              {primarySessions.map((session) => {
                const details = detailsMap?.[session.session_id];
                const students =
                  details?.students?.map((s: SessionStudent) => ({
                    ...s,
                    year_level: s.year_level ?? undefined,
                  })) ?? [];
                return (
                  <TutorDashboardSessionCard
                    key={session.session_id}
                    session={session}
                    staff={details?.staff}
                    students={students}
                    onOpen={() => handleOpenSession(session.session_id)}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No upcoming sessions in the next several weeks. Check your timetable under Classes.
            </p>
          )}
        </section>

        {staffId ? (
          <UnloggedSessionsTableSection staffId={staffId} onLogSession={handleOpenLogSession} />
        ) : null}

        <section aria-labelledby="quick-links-heading" className="space-y-4">
          <h2 id="quick-links-heading" className="text-2xl font-semibold">
            Quick links
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link href={item.href} className="group block h-full">
                    <Card
                      className={cn(
                        tutorCardCn('h-full'),
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
      </TutorPageContainer>
    </div>

    <SessionModal
      isOpen={isSessionModalOpen}
      sessionId={selectedSessionId}
      onClose={handleCloseSessionModal}
      onLogSessionClick={() => handleOpenLogSession(selectedSessionId ?? undefined)}
      currentStaffId={staffId}
      currentStaffIdForNotes={staffId}
      refreshTrigger={logSessionCompletedCount}
    />

    {staffId ? (
      <LogSessionModal
        isOpen={isLogSessionModalOpen}
        onClose={handleCloseLogSession}
        currentStaffId={staffId}
        preselectedSessionId={logSessionPreselectedId}
      />
    ) : null}
    </>
  );
}
